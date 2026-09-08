/* ============================================================================
   GRAVADOR
   Abre a cena num Chromium, pede quadro por quadro (nada depende de relógio:
   `seek(t)` desenha o instante t exato) e junta tudo com ffmpeg.

     node src/render/gravar.js                      usa dados de demonstração
     node src/render/gravar.js --dados dia01.json   usa dados de verdade
     node src/render/gravar.js --visivel            abre a janela e usa a GPU
     node src/render/gravar.js --ate 3              grava só os 3 primeiros seg
============================================================================ */
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { sobeServidor } from './servidor.js';
import { roteiro, gerar } from '../narracao.js';
import { env } from '../config.js';
import { marca } from '../marca.js';

const exec = promisify(execFile);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ---------------- argumentos ---------------- */
const argv = process.argv.slice(2);
const opt = (nome, padrao = null) => {
  const i = argv.indexOf('--' + nome);
  return i >= 0 ? (argv[i+1] && !argv[i+1].startsWith('--') ? argv[i+1] : true) : padrao;
};
const ARQ_DADOS = opt('dados');
const VISIVEL   = !!opt('visivel');
const ATE       = opt('ate') ? Number(opt('ate')) : null;
const SAIDA     = String(opt('saida', path.join(RAIZ, 'out', 'reel.mp4')));
const TRILHA    = String(opt('trilha', path.join(RAIZ, 'Trilha.mp3')));
let musicaEm = opt('musica-em') !== null ? Number(opt('musica-em')) : null;
const SEM_VOZ   = !!opt('sem-voz');

const dados = ARQ_DADOS ? JSON.parse(fs.readFileSync(path.resolve(ARQ_DADOS), 'utf8')) : null;

/* Estado do dia. Sem arquivo de dados, é a demonstração embutida na cena. */
const estado = dados
  ? { dia: dados.dia ?? 1, antes: dados.antes ?? 0, depois: (dados.antes ?? 0) + (dados.novos?.length ?? 0) }
  : { dia: 1, antes: 0, depois: 148 };

/* ---------------- ffmpeg ----------------
   Não verifique o binário com pipe: `ffmpeg -version | head -1` devolve o
   código de saída do head e passa até com o binário ausente. */
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  console.error('ffmpeg não encontrado. Rode: npm i ffmpeg-static');
  process.exit(1);
}

/* maxBuffer padrão do execFile é 1MB: estoura no meio do ffmpeg e o sintoma é
   `status: null` com stderr vazio, indistinguível de binário ausente. */
const OPC_EXEC = { maxBuffer: 32 * 1024 * 1024 };
async function ffmpeg(args) {
  try {
    return await exec(ffmpegPath, args, OPC_EXEC);
  } catch (e) {
    throw new Error(`ffmpeg falhou (code=${e.code} signal=${e.signal} status=${e.status})\n`
      + String(e.stderr || '').split('\n').slice(-25).join('\n'));
  }
}

/* Duração de um áudio. O ffmpeg-static não traz ffprobe, então perguntamos ao
   próprio ffmpeg e lemos o cabeçalho que ele imprime no stderr. */
async function duracaoAudio(arq) {
  /* Com arquivo válido o ffmpeg SAI COM 0, então ler a duração só no catch
     devolvia zero sempre — e a trilha subia por cima da narração inteira.
     O cabeçalho vai para o stderr nos dois casos. */
  const ler = txt => {
    const m = String(txt || '').match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    return m ? (+m[1])*3600 + (+m[2])*60 + (+m[3]) : 0;
  };
  try {
    const { stderr } = await exec(ffmpegPath, ['-hide_banner','-i',arq,'-f','null','-'], OPC_EXEC);
    return ler(stderr);
  } catch (e) { return ler(e.stderr); }
}

/* ---------------- narração ----------------
   Gerada ANTES de filmar: é a duração dela que diz quanto o vídeo precisa
   esticar. Filmar primeiro e descobrir depois seria refilmar tudo. */
const ATRASO_VOZ = 0.8;   // a voz entra depois do primeiro respiro da abertura

/* ---------------- níveis de áudio ----------------
   Multiplicar a trilha por um número solto não funciona: depende de quão alta
   ela já é. A Trilha.mp3 tem média de -21 dB, então x0,24 punha a música em
   -34 dB contra uma voz em -17 dB — 17 dB abaixo, ou seja, inaudível. E ir de
   0,20 para 0,24 é +1,6 dB, abaixo do limiar do perceptível.

   Aqui as duas faixas são normalizadas para um alvo de LOUDNESS conhecido, e
   só então misturadas. Assim os números abaixo valem para qualquer trilha que
   você trocar, não só para esta. */
const AUDIO = {
  alvoMusica: -14,      // LUFS da trilha depois de normalizada
  alvoVoz: -15,         // LUFS da locução
  sobVoz: 0.33,         // fração da trilha enquanto a voz fala (~-24 dB)
  sozinha: 1.00,        // fração depois que a voz termina  (~-15 dB)
  rampa: 0.9,           // segundos para a trilha subir quando a voz acaba
  cauda: 4.5,           // segundos de música sozinha antes do fade final
  fade: 1.2,            // duração do fade de saída
};
/* loudnorm reescreve o layout de canais: sem este aformat depois dele o
   ffmpeg aborta com "Cannot select channel layout". */
const FMT = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo';

let narracao = null, narDur = 0, legendas = null;
if (!SEM_VOZ && env('ELEVEN_API_KEY')) {
  const texto = roteiro(estado);
  console.log('roteiro: ' + texto);
  const r = await gerar(texto);
  narracao = r.arquivo;
  narDur = await duracaoAudio(narracao);
  // as marcas vêm relativas ao áudio; o vídeo as quer relativas a ele mesmo
  legendas = (r.legendas || []).map(b => ({
    t0: b.t0 + ATRASO_VOZ, t1: b.t1 + ATRASO_VOZ,
    palavras: b.palavras.map(w => ({ p: w.p, t0: w.t0 + ATRASO_VOZ, t1: w.t1 + ATRASO_VOZ })),
  }));
  console.log(`voz: ${narDur.toFixed(1)}s · ${legendas.length} blocos de legenda${r.doCache ? ' (do cache)' : ''}`);
} else if (!SEM_VOZ) {
  console.log('sem ELEVEN_API_KEY: vídeo sai sem locução nem legenda');
}

/* ---------------- gravação ---------------- */
const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bn-'));
const srv = await sobeServidor(RAIZ);

/* Usa o Google Chrome já instalado quando existe: evita o download do
   Chromium da Playwright e, no mac, rende pela GPU de verdade. `--canal
   chromium` força o navegador embutido, que é o caminho no GitHub Actions. */
const CANAL = String(opt('canal', 'chrome'));
const nav = await chromium.launch({
  headless: !VISIVEL,
  ...(CANAL === 'chromium' ? {} : { channel: CANAL }),
  args: [
    '--enable-unsafe-swiftshader',   // WebGL2 sem GPU, para o runner do Actions
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--disable-lcd-text',
  ],
});
const ctx = await nav.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
});
const pag = await ctx.newPage();
pag.on('pageerror', e => console.error('erro na cena:', e.message));
pag.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });

await pag.addInitScript(d => {
  window.__GRAVANDO = true;
  if (d.escala) window.__ESCALA = d.escala;
  if (d.dados) window.__DADOS = d.dados;
  if (d.legendas) window.__LEGENDAS = d.legendas;
}, { dados, legendas, escala: opt('escala') ? Number(opt('escala')) : null });

await pag.goto(`http://127.0.0.1:${srv.porta}/src/cena/cena.html`, { waitUntil: 'load' });
await pag.evaluate(() => window.__cena.pronta);

/* Teto de 30s: quem reparte o tempo entre abertura, retratos, enxame e cauda
   é a cena. Aqui só entregamos o instante em que a voz acaba. */
const TETO = Number(opt('teto', 30));
await pag.evaluate(a => window.__cena.ajusta(a),
  { vozFim: narracao ? ATRASO_VOZ + narDur : 0, teto: TETO });

const { fps, duracao, passo, nCards } = await pag.evaluate(() => ({
  fps: window.__cena.roteiro.fps,
  duracao: window.__cena.roteiro.duracao,
  passo: window.__cena.roteiro.passoCard,
  nCards: window.__cena.roteiro.nCards,
}));
/* Sincronia da trilha: quando o vídeo tem um clímax marcado — no dia 1, o
   instante em que o horizonte de eventos aparece — a música recua o suficiente
   para que o ápice dela caia exatamente ali. Sem clímax, começa no ponto
   padrão em que a faixa fica interessante. */
const climax = await pag.evaluate(() => window.__cena.climax ?? null);
if (musicaEm === null) {
  musicaEm = climax != null
    ? Math.max(0, marca.trilha.apice - climax)
    : marca.trilha.padrao;
}
console.log(`traçado de raios em ${await pag.evaluate(() => window.__cena.resolucao())} (quadro 1080x1920)`);
console.log(`linha do tempo: ${duracao.toFixed(1)}s · ${nCards} retratos a cada ${passo.toFixed(2)}s`);
console.log(climax != null
  ? `trilha: entra em ${musicaEm.toFixed(1)}s para o ápice (${marca.trilha.apice}s) cair no clímax aos ${climax.toFixed(1)}s`
  : `trilha: entra em ${musicaEm.toFixed(1)}s`);
if (duracao > TETO + 0.05) {
  console.log(`⚠  ${duracao.toFixed(1)}s passa do teto de ${TETO}s — a locução sozinha ocupa ${(ATRASO_VOZ + narDur).toFixed(1)}s`);
}
const info = await pag.evaluate(() => window.__cena.dados);
const total = Math.round((ATE ?? duracao) * fps);

console.log(`cena pronta · ${info.antes} → ${info.depois} pessoas (+${info.novos} hoje)`);
console.log(`gravando ${total} quadros a ${fps}fps (${(total/fps).toFixed(1)}s)${VISIVEL ? ' · GPU' : ' · swiftshader'}`);

const quadro = pag.locator('#quadro');
for (let i = 0; i < total; i++) {
  await pag.evaluate(t => window.__cena.seek(t), i / fps);
  await quadro.screenshot({ path: path.join(tmp, String(i).padStart(5,'0') + '.png') });
  if (i % 30 === 0 || i === total - 1) {
    const s = (Date.now()-t0)/1000;
    process.stdout.write(`\r  ${i+1}/${total}  ${(s).toFixed(0)}s  (${((i+1)/s).toFixed(1)} q/s)   `);
  }
}
console.log('');
await nav.close();
srv.fecha();

/* ---------------- montagem ---------------- */
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
const DUR = total / fps;
const temTrilha = fs.existsSync(TRILHA);

const args = ['-y', '-framerate', String(fps), '-i', path.join(tmp, '%05d.png')];

/* A trilha entra a partir do ponto em que ela fica interessante (-ss antes do
   -i, que é o seek rápido) e é abaixada enquanto a voz fala. */
if (temTrilha) args.push('-ss', musicaEm.toFixed(3), '-i', TRILHA);
if (narracao)  args.push('-i', narracao);

let filtro = null, mapaAudio = null;
const iMus = 1, iVoz = temTrilha ? 2 : 1;

if (temTrilha && narracao) {
  const fimVoz = ATRASO_VOZ + narDur;
  const ms = Math.round(ATRASO_VOZ * 1000);
  const sobe = (AUDIO.sozinha - AUDIO.sobVoz).toFixed(3);
  filtro =
    `[${iMus}:a]atrim=0:${DUR.toFixed(3)},asetpts=N/SR/TB,` +
    `loudnorm=I=${AUDIO.alvoMusica}:TP=-1.5:LRA=11,${FMT},` +
    // sobe até o nível cheio numa rampa de 1,4s assim que a voz termina
    `volume='${AUDIO.sobVoz}+${sobe}*min(1,max(0,(t-${fimVoz.toFixed(2)})/${AUDIO.rampa}))':eval=frame,` +
    `afade=t=in:st=0:d=1.0,afade=t=out:st=${Math.max(0, DUR-AUDIO.fade).toFixed(2)}:d=${AUDIO.fade}[mus];` +
    `[${iVoz}:a]loudnorm=I=${AUDIO.alvoVoz}:TP=-1.5:LRA=7,${FMT},adelay=${ms}|${ms}[voz];` +
    `[mus][voz]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]`;
  mapaAudio = '[a]';
} else if (temTrilha) {
  filtro = `[${iMus}:a]atrim=0:${DUR.toFixed(3)},asetpts=N/SR/TB,` +
           `loudnorm=I=${AUDIO.alvoMusica}:TP=-1.5:LRA=11,${FMT},` +
           `afade=t=in:st=0:d=1.0,afade=t=out:st=${Math.max(0, DUR-AUDIO.fade).toFixed(2)}:d=${AUDIO.fade}[a]`;
  mapaAudio = '[a]';
} else if (narracao) {
  const ms = Math.round(ATRASO_VOZ * 1000);
  filtro = `[${iVoz}:a]loudnorm=I=${AUDIO.alvoVoz}:TP=-1.5:LRA=7,${FMT},` +
           `adelay=${ms}|${ms},apad,atrim=0:${DUR.toFixed(3)}[a]`;
  mapaAudio = '[a]';
} else {
  args.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100');
}

if (filtro) args.push('-filter_complex', filtro, '-map', '0:v', '-map', mapaAudio);
else args.push('-map', '0:v', '-map', '1:a');

args.push(
  '-c:v','libx264','-profile:v','high','-level','4.1',
  '-pix_fmt','yuv420p',
  /* Alvo de QUALIDADE, não de taxa. Esta cena alterna quadros quase todos
     pretos com quadros cheios de estrias finas; taxa fixa gasta igual nos dois
     e sobra pouco justamente onde há detalhe. Com CRF o codificador economiza
     no escuro e investe no disco de acreção — arquivo menor e mais nítido.
     O teto existe só para não estourar o que o Instagram aceita. */
  '-crf','19','-preset','slow',
  '-maxrate','14000k','-bufsize','20000k',
  '-r', String(fps),
  '-c:a','aac','-b:a','160k','-ar','44100','-ac','2',
  '-shortest','-movflags','+faststart',
  SAIDA,
);
await ffmpeg(args);
fs.rmSync(tmp, { recursive: true, force: true });

const mb = (fs.statSync(SAIDA).size / 1048576).toFixed(1);
console.log(`\n${SAIDA}  ${mb} MB  ${(total/fps).toFixed(1)}s  ${((Date.now()-t0)/1000).toFixed(0)}s de trabalho`);
if (!temTrilha) console.log(`⚠  trilha não encontrada em ${TRILHA}`);
if (!narracao && !SEM_VOZ) console.log('⚠  vídeo sem locução');
