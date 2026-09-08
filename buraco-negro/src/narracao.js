/* ============================================================================
   NARRAÇÃO
   Monta o roteiro falado a partir do estado do dia e manda para o ElevenLabs.

   O texto muda sozinho a cada vídeo: fase, estágio, ganho do dia e próximo
   marco saem todos da régua. Nada aqui é escrito à mão por vídeo.
============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import R from './regua.js';
import { env, RAIZ } from './config.js';

/* Voz da biblioteca: responde ao TTS mesmo sem estar em "minhas vozes".
   O v3 é o que dá emoção e desenvoltura — o multilingual_v2 lê plano. */
const VOZ_PADRAO = 'MnXdp1RrMFboJjgMtirI';
const MODELO = env('ELEVEN_MODEL', 'eleven_v3');

/* A palavra que faz alguém entrar. A coleta filtra por ela. */
export const CHAVE = 'EU CREIO';

/* O dia 1 é o único que diz a chamada em voz alta: é ele que explica a
   mecânica, e não há ninguém dentro para receber boas-vindas ainda. */
export const estreiaFalada = n =>
  'Dia um, reunindo futuros milionários em uma estrela até ela se tornar um buraco negro. ' +
  `Status atual: ${R.porExtenso(n)} seguidores, anã vermelha. ` +
  'Se você acredita que será o primeiro milionário de sua família, ' +
  `comente ${CHAVE} para se juntar a nós. ` +
  'Siga e mande esse reels para o seu sócio.';

/* Do segundo vídeo em diante o fecho é este, e é ritual: a mesma frase toda
   vez, palavra por palavra, é o que faz quem entrou reconhecer que aquilo é
   sobre ele. O CTA já está escrito na tela — dizê-lo de novo custava cinco
   segundos de vídeo sem acrescentar nada. */
export const FECHO_FALADO = 'Aos que chegaram, sejam bem-vindos à Singularidade.';

/* Dia sem ninguém entrando não tem a quem dar boas-vindas. */
const FECHO_VAZIO = 'A Singularidade segue esperando.';

/* ---------------------------------------------------------------------------
   O ROTEIRO

   Não há IA aqui, de propósito. A régua já sabe todos os fatos, e o único
   ganho que um modelo de linguagem traria — variar a frase — sai de graça com
   rotação de variantes. Em troca ele traria a chance de errar um número, e
   número errado num Reel publicado sozinho não tem conserto.

   Cada trecho tem várias formas de ser dito. A escolha vem do número do dia,
   então é reproduzível: o vídeo do dia 47 é sempre o mesmo. Os tamanhos das
   listas (5, 4, 3, 4) são escolhidos para a combinação só se repetir a cada
   60 dias.
--------------------------------------------------------------------------- */
const pega = (lista, dia) => lista[((dia % lista.length) + lista.length) % lista.length];

const ABERTURA_ESTRELA = [
  d => `Dia ${d}. Reunindo futuros milionários numa estrela, até ela virar um buraco negro.`,
  d => `Dia ${d}. Mais um dia empilhando futuros milionários dentro de uma estrela.`,
  d => `Dia ${d}. A estrela que vai colapsar num buraco negro recebeu gente nova.`,
  d => `Dia ${d}. Seguimos juntando futuros milionários numa estrela só.`,
  d => `Dia ${d}. Todo dia mais gente entra na estrela que vai virar buraco negro.`,
];
const ABERTURA_BURACO = [
  d => `Dia ${d}. Reunindo futuros milionários num buraco negro que cresce a cada pessoa que entra.`,
  d => `Dia ${d}. O buraco negro ficou maior de novo.`,
  d => `Dia ${d}. Mais um dia alimentando o buraco negro com futuros milionários.`,
  d => `Dia ${d}. Cada pessoa que entra torna o buraco negro mais pesado.`,
  d => `Dia ${d}. Seguimos empurrando futuros milionários para dentro do buraco negro.`,
];
const ESTADO = [
  e => `Estado atual: ${e}.`,
  e => `Por enquanto, ${e}.`,
  e => `Neste momento: ${e}.`,
  e => `Hoje ela é ${e}.`,
];
const ESTADO_BURACO = [
  e => `Estado atual: ${e}.`,
  e => `Ele pesa agora ${e}.`,
  e => `Neste momento: ${e}.`,
  e => `Já são ${e}.`,
];
const GANHO = [
  g => `As entradas de hoje somam mais ${g}.`,
  g => `Quem entrou hoje trouxe mais ${g}.`,
  g => `Hoje ela ganhou ${g}.`,
];
const GANHO_BURACO = [
  g => `As entradas de hoje somam mais ${g}.`,
  g => `Quem entrou hoje trouxe mais ${g}.`,
  g => `Hoje ele ganhou ${g}.`,
];
const noPresente = f => f
  .replace(/^virar /, 'vira ').replace(/^alcançar /, 'alcança ')
  .replace(/^ter /, 'tem ').replace(/^não aguentar mais e explodir/, 'não aguenta mais e explode');

const FALTAM = [
  (n, f, ela) => `Faltam ${n} pessoas para ${ela ? 'ela' : 'ele'} ${f}.`,
  (n, f, ela) => `Mais ${n} pessoas e ${ela ? 'ela' : 'ele'} ${noPresente(f)}.`,
  (n, f, ela) => `Para ${ela ? 'ela' : 'ele'} ${f}, faltam ${n} pessoas.`,
  (n, f, ela) => `Ainda faltam ${n} pessoas para ${ela ? 'ela' : 'ele'} ${f}.`,
];
const MARCO_HOJE = [
  (f, ela) => `Hoje ${ela ? 'ela' : 'ele'} ${f}.`,
  (f, ela) => `Marco batido: hoje ${ela ? 'ela' : 'ele'} ${f}.`,
  (f, ela) => `Aconteceu hoje: ${ela ? 'ela' : 'ele'} ${f}.`,
];

/* "virar uma anã laranja" -> "virou uma anã laranja" */
const noPassado = f => f
  .replace(/^virar /, 'virou ').replace(/^alcançar /, 'alcançou ')
  .replace(/^ter /, 'passou a ter ').replace(/^não aguentar mais e explodir/, 'não aguentou mais e explodiu');

export function roteiro({ dia, antes, depois }) {
  const d = R.porExtenso(dia);
  const ganho = R.ganhoDoDia(antes, depois);
  const marco = R.proximoMarco(depois);
  const cruzados = R.MARCOS.filter(m => m.n > antes && m.n <= depois);
  /* Estreia é o dia 1, não "dia sem ninguém dentro". O dia 2 com a estrela
     ainda vazia é um dia normal em que gente entrou — e precisa dizer isso. */
  const estreia = dia === 1;
  const semNinguem = depois === antes;
  const naEstrela = R.fase(depois) === 'estrela';
  const partes = [];

  if (depois >= R.META) {
    partes.push(
      `Dia ${d}. A meta foi alcançada: um milhão de pessoas dentro.`,
      `O buraco negro chegou a ${R.fmtMassaFalado(R.massa(depois))}, maior que o Tón seiscentos e dezoito,`,
      `que era o maior que a humanidade já tinha medido.`);
  } else if (ganho.colapsou) {
    partes.push(
      `Dia ${d}. Hoje a estrela não aguentou.`,
      `Com ${R.porExtenso(depois, true)} pessoas dentro ela passou de ${R.fmtMassaFalado(R.massa(antes))} e explodiu.`,
      `Quase tudo foi expelido: sobraram ${R.fmtMassaFalado(R.massa(depois))}, e nasceu o buraco negro.`);
    /* Sem a linha do próximo marco: no dia do colapso ela empurrava a fala para
       28 segundos, e o que importa neste vídeo é a explosão, não a meta seguinte. */
  } else if (estreia) {
    return estreiaFalada(depois);
  } else {
    /* Na estreia a variação é desligada: o texto de abertura da série foi
       escrito à mão e é ele que define o tom de tudo o que vem depois.
       Num dia em que ninguém entrou também: metade das aberturas diz "recebeu
       gente nova", e a primeira é a única neutra. */
    const giro = (estreia || semNinguem) ? 0 : dia;
    partes.push(pega(naEstrela ? ABERTURA_ESTRELA : ABERTURA_BURACO, giro)(d));
    partes.push(pega(naEstrela ? ESTADO : ESTADO_BURACO, giro)(
      naEstrela ? R.estrela(depois).estagio.nome : R.fmtMassaFalado(R.massa(depois))));
    // "trouxe mais zero massas da Terra" não se diz: dia parado só fala do que falta
    if (!estreia && !semNinguem) {
      partes.push(pega(naEstrela ? GANHO : GANHO_BURACO, dia)(ganho.falado));
    }
    if (!estreia) {
      if (cruzados.length) partes.push(pega(MARCO_HOJE, dia)(noPassado(cruzados[cruzados.length - 1].fala), naEstrela));
      else if (marco) partes.push(pega(FALTAM, dia)(R.porExtenso(marco.n - depois, true), marco.fala, naEstrela));
    }
  }
  partes.push(estreia ? CTA_FALADO : depois > antes ? FECHO_FALADO : FECHO_VAZIO);
  return partes.join(' ');
}

/* ---------------------------------------------------------------------------
   Legendas. O endpoint /with-timestamps devolve início e fim de CADA CARACTERE
   do áudio gerado. Daí saem palavras, e das palavras os blocos que aparecem na
   tela. É sincronia medida no próprio áudio, não estimada por contagem de
   letras — que erra feio quando a voz respira no meio da frase.
--------------------------------------------------------------------------- */
const MAX_PALAVRAS = 4;    // por bloco na tela
const MAX_CARACTERES = 26;
const PAUSA_QUEBRA = 0.5;  // silêncio que já justifica trocar de bloco

function blocos(alinhamento) {
  const ch = alinhamento.characters;
  const ini = alinhamento.character_start_times_seconds;
  const fim = alinhamento.character_end_times_seconds;

  const palavras = [];
  let atual = null;
  for (let i = 0; i < ch.length; i++) {
    if (/\s/.test(ch[i])) { if (atual) { palavras.push(atual); atual = null; } continue; }
    if (!atual) atual = { p: '', t0: ini[i], t1: fim[i] };
    atual.p += ch[i];
    atual.t1 = fim[i];
  }
  if (atual) palavras.push(atual);

  const saida = [];
  let b = null;
  for (const w of palavras) {
    const fechou = b && /[.!?:;]$/.test(b.palavras.at(-1).p);   // fim de frase fecha bloco
    const cabe = b && !fechou
      && b.palavras.length < MAX_PALAVRAS
      && (b.texto.length + 1 + w.p.length) <= MAX_CARACTERES
      && (w.t0 - b.t1) < PAUSA_QUEBRA;
    if (cabe) { b.texto += ' ' + w.p; b.t1 = w.t1; b.palavras.push(w); }
    else { b = { texto: w.p, t0: w.t0, t1: w.t1, palavras: [w] }; saida.push(b); }
  }
  return saida;
}

/* ---------------------------------------------------------------------------
   TTS. O mp3 e as legendas ficam em cache pelo hash do texto: regravar o vídeo
   dez vezes não gasta dez vezes os caracteres do plano.
--------------------------------------------------------------------------- */
export async function gerar(texto, { voz, pasta } = {}) {
  const chave = env('ELEVEN_API_KEY');
  if (!chave) throw new Error('ELEVEN_API_KEY ausente — ponha no .env');
  voz = voz || env('ELEVEN_VOICE_ID', VOZ_PADRAO);
  pasta = pasta || path.join(RAIZ, 'out', 'narracao');
  fs.mkdirSync(pasta, { recursive: true });

  const hash = crypto.createHash('sha1').update(voz + '|' + MODELO + '|' + texto).digest('hex').slice(0, 12);
  const saida = path.join(pasta, hash + '.mp3');
  const marcas = path.join(pasta, hash + '.json');
  if (fs.existsSync(saida) && fs.existsSync(marcas)) {
    return { arquivo: saida, legendas: JSON.parse(fs.readFileSync(marcas, 'utf8')), doCache: true };
  }

  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voz}/with-timestamps?output_format=mp3_44100_128`,
    { method: 'POST',
      headers: { 'xi-api-key': chave, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: texto,
        model_id: MODELO,
        /* No v3 o stability só aceita 0 (criativo), 0,5 (natural) ou 1 (firme). */
        voice_settings: { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true },
      }) });

  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  fs.writeFileSync(saida, Buffer.from(j.audio_base64, 'base64'));
  const legendas = blocos(j.alignment || j.normalized_alignment);
  fs.writeFileSync(marcas, JSON.stringify(legendas));
  return { arquivo: saida, legendas, doCache: false };
}
