/* ============================================================================
   RODADA
   Uma execução = um vídeo. Coleta quem comentou, grava, publica, guarda.

     node src/run.js              coleta, grava e publica
     node src/run.js --seco       coleta e grava, não publica
     node src/run.js --so-coletar só mostra quem entraria, não grava nada
============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { RAIZ } from './config.js';
import { marca } from './marca.js';
import { carregar, salvar } from './estado.js';
import { coletar } from './coletar.js';
import { legenda } from './legenda.js';
import { publicarReel } from './publicar.js';
import { perfil } from './instagram.js';
import R from './regua.js';

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const SECO = flag('seco');
const SO_COLETAR = flag('so-coletar');

const rodar = (cmd, args) => new Promise((ok, falha) => {
  const p = spawn(cmd, args, { stdio: 'inherit', cwd: RAIZ });
  p.on('close', c => (c === 0 ? ok() : falha(new Error(`${path.basename(args[0])} saiu com código ${c}`))));
});

const estado = carregar();
const antes = estado.participantes.length;
const dia = estado.dia + 1;

const conta = await perfil();
console.log(`@${conta.username} · ${conta.followers_count} seguidores · dia ${dia} · ${antes} dentro`);

const novos = await coletar(estado);

if (SO_COLETAR) {
  for (const p of novos) console.log(`  @${p.username}${p.foto ? '' : '  (sem foto: entra com iniciais)'}`);
  console.log(`${novos.length} entrariam · total ficaria em ${antes + novos.length}`);
  process.exit(0);
}

if (novos.length < marca.minimoParaPublicar && !flag('forcar')) {
  console.log(`nada a publicar: ${novos.length} pessoa(s) nova(s), mínimo é ${marca.minimoParaPublicar}.`);
  console.log('o dia não foi consumido — os comentários continuam valendo na próxima rodada.');
  console.log('(use --forcar para publicar mesmo assim)');
  process.exit(0);
}

/* Quem tem foto vai para os retratos em close. Não é preferência: um rosto
   reconhecível é o que faz a pessoa compartilhar, e a foto é o que a série
   tem para oferecer. Quem não tem entra no enxame, e continua contando igual
   na massa. */
const ordenados = [...novos].sort((a, b) => (b.foto ? 1 : 0) - (a.foto ? 1 : 0));

const dados = {
  dia,
  /* O vídeo de estreia não tem ninguém para mostrar entrando. Em vez de uma
     anã vermelha parada por meio minuto, ele mostra a viagem inteira: a
     estrela percorre os estágios, colapsa e vira o buraco negro no tamanho
     que terá com um milhão de pessoas. */
  previa: dia === 1,
  /* As lendas só entram na estreia, e o arquivo é opcional: sem ele o vídeo
     sai igual, só sem elas. Elas não contam no contador — não comentaram. */
  lendas: dia === 1 && fs.existsSync(path.join(RAIZ, 'lendas.json'))
    ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'lendas.json'), 'utf8'))
    : [],
  titulo: marca.titulo,
  cta: marca.cta,
  antes,
  novos: ordenados.map(p => ({ username: p.username, nome: p.nome, foto: p.foto })),
};

fs.mkdirSync(path.join(RAIZ, 'out'), { recursive: true });
const arqDados = path.join(RAIZ, 'out', `dia-${String(dia).padStart(3, '0')}.json`);
const arqVideo = path.join(RAIZ, 'out', `dia-${String(dia).padStart(3, '0')}.mp4`);
fs.writeFileSync(arqDados, JSON.stringify(dados, null, 2));

await rodar(process.execPath, [path.join(RAIZ, 'src/render/gravar.js'), '--dados', arqDados, '--saida', arqVideo]);

const depois = antes + novos.length;
const texto = legenda({ dia, antes, depois });

if (SECO) {
  console.log('\n--seco: não publiquei. Legenda que iria junto:\n');
  console.log(texto);
  console.log(`\nvídeo em ${arqVideo}`);
  process.exit(0);
}

console.log('\npublicando...');
const post = await publicarReel({ arquivo: arqVideo, legenda: texto });
console.log(`  publicado: ${post.permalink || post.mediaId}`);

/* O estado só muda DEPOIS de o post existir. Se a publicação falhar, ninguém
   é marcado como "já dentro" e a próxima rodada tenta de novo com as mesmas
   pessoas — em vez de perdê-las para sempre. */
estado.dia = dia;
estado.participantes.push(...novos.map(p => ({
  username: p.username, nome: p.nome, foto: p.foto,
  comentario: p.comentario, quando: p.quando, dia,
})));
estado.publicados.push({
  dia, mediaId: post.mediaId, permalink: post.permalink || null,
  quando: new Date().toISOString(), novos: novos.length, total: depois,
  massa: R.massa(depois), fase: R.fase(depois),
});
salvar(estado);
console.log(`estado salvo · ${depois} pessoas dentro · ${R.fmtMassa(R.massa(depois))}`);
