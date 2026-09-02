import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { camadaDeTexto, L, A } from './texto.js'

// No runner do Actions o ffmpeg ja vem instalado; localmente aceita um
// caminho pelo ambiente para nao exigir instalacao no sistema.
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const ff = (args) => {
  try {
    return execFileSync(FFMPEG, ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 32 * 1024 * 1024 })
  } catch (e) {
    // Sem isto o ffmpeg falha so com um codigo de saida e a mensagem se perde.
    // status null sem stderr nao diz nada: pode ser binario ausente (ENOENT),
    // morte por sinal, ou estouro do buffer de saida. Reporta os tres.
    const causa = [
      e.code && `code=${e.code}`,
      e.signal && `signal=${e.signal}`,
      e.status != null && `status=${e.status}`,
    ].filter(Boolean).join(' ') || 'sem causa reportada'
    throw new Error(`ffmpeg falhou [${causa}] binario=${FFMPEG}\n${e.stderr?.toString().trim() || '(stderr vazio)'}`)
  }
}

// Todo segmento sai identico: mesmo tamanho, mesma taxa, sem audio. E o que
// permite concatenar sem reencodar duas vezes e sem dessincronizar.
const PADRAO = ['-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30']
// force_original_aspect_ratio=increase, nao scale pela largura: fonte alguns
// pixels mais larga que 9:16 (a selfie e 1520x2688) escalava para uma altura
// menor que o corte e o ffmpeg abortava. Assim sempre cobre e depois corta.
const ENQUADRA = `scale=${L}:${A}:force_original_aspect_ratio=increase,crop=${L}:${A}`

/**
 * Duracao de um arquivo, em segundos.
 *
 * `ffmpeg -i` sem saida sempre termina com codigo 1 e escreve os metadados no
 * stderr — por isso le do erro, nao do sucesso. Evita depender do ffprobe, que
 * nem sempre acompanha o binario.
 */
function duracao(arquivo) {
  let texto = ''
  try {
    execFileSync(FFMPEG, ['-i', arquivo], { stdio: ['ignore', 'ignore', 'pipe'] })
  } catch (e) {
    texto = e.stderr?.toString() ?? ''
  }
  const m = texto.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/)
  if (!m) throw new Error(`nao consegui medir ${arquivo}`)
  return +m[1] * 3600 + +m[2] * 60 + +m[3]
}

/** Clipe base, opcionalmente com uma camada PNG por cima. */
function segmentoDeVideo(saida, entrada, camada) {
  if (!camada) return ff(['-i', entrada, '-vf', ENQUADRA, ...PADRAO, saida])
  ff(['-i', entrada, '-i', camada, '-filter_complex', `[0:v]${ENQUADRA}[v];[v][1:v]overlay=0:0`, ...PADRAO, saida])
}

/**
 * Imagem parada com zoom in lento.
 *
 * O zoompan trabalha sobre um quadro ampliado de proposito: ele arredonda a
 * escala por quadro, e num quadro pequeno esse arredondamento vira tremor
 * visivel. Ampliar antes e devolver ao tamanho final elimina o efeito.
 */
function segmentoDeFoto(saida, imagem, segundos, zoom = 0.06) {
  const q = Math.round(segundos * 30)
  const filtro =
    `scale=${L * 2}:${A * 2}:force_original_aspect_ratio=increase,crop=${L * 2}:${A * 2},` +
    `zoompan=z='1+${zoom}*on/${q - 1}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${q}:s=${L}x${A}:fps=30`
  // -framerate 1 e essencial: o `d` do zoompan conta quadros de saida POR
  // quadro de entrada. Na taxa padrao a imagem entrava 25 vezes e cada entrada
  // virava 30 saidas — 1 segundo pedido saia com 25. Uma entrada so, 30 saidas.
  ff(['-framerate', '1', '-loop', '1', '-t', '1', '-i', imagem, '-vf', filtro, '-frames:v', String(q), ...PADRAO, saida])
}

/** Tutorial acelerado. O audio some junto — a trilha entra depois, por cima. */
function segmentoAcelerado(saida, entrada, fator) {
  ff(['-i', entrada, '-vf', `${ENQUADRA},setpts=PTS/${fator}`, ...PADRAO, saida])
}

/**
 * Monta o Reel inteiro.
 *
 * Cada trecho vira um arquivo antes de concatenar, em vez de um filter_complex
 * unico: com oito entradas o grafo fica ilegivel e um erro em qualquer ponto
 * derruba tudo sem dizer onde. Assim da pra abrir o pedaco que saiu errado.
 */
export async function montarReel({
  bases, fotos, selfie, gancho, textoSelfie, cta, trilha, arteCapa,
  tutorialFator = 1, segundosPorInsert = 2.5, saida, tmp,
}) {
  mkdirSync(tmp, { recursive: true })
  const p = (n) => join(tmp, n)

  // Camadas de texto
  writeFileSync(p('t-gancho.png'), await camadaDeTexto({ ...gancho, centroY: gancho.centroY ?? 1120 }))
  writeFileSync(p('t-selfie.png'), await camadaDeTexto({ linha1: textoSelfie, centroY: 300 }))
  // A base do CTA nao traz texto gravado: o pedido fica so no gesto e ninguem
  // adivinha o que comentar. O texto sobe sobre a camiseta preta, que e onde
  // ha contraste garantido em qualquer quadro do clipe.
  writeFileSync(p('t-cta.png'), await camadaDeTexto({ ...cta, centroY: cta.centroY ?? 1250, corpo: cta.corpo ?? 84 }))

  // A foto heroina entra em quadrado sobre o clipe do "aponta". Corte central:
  // os retratos vem centrados, entao o quadrado nunca decepa a cabeca.
  const lado = 560
  const quadro = await sharp(fotos[0]).resize(lado, lado, { fit: 'cover' }).png().toBuffer()
  const sobre = await sharp({ create: { width: L, height: A, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: quadro, top: 1120, left: Math.round((L - lado) / 2) }])
    .png()
    .toBuffer()
  writeFileSync(p('t-quadrada.png'), sobre)

  const partes = []
  const add = (n) => partes.push(p(n))

  segmentoDeVideo(p('1.mp4'), bases.gancho, p('t-gancho.png')); add('1.mp4')
  segmentoDeVideo(p('2.mp4'), bases.aponta, p('t-quadrada.png')); add('2.mp4')
  segmentoDeFoto(p('3.mp4'), fotos[0], 1); add('3.mp4')
  segmentoDeVideo(p('4.mp4'), bases.selfie, p('t-selfie.png')); add('4.mp4')
  segmentoDeFoto(p('5.mp4'), selfie, 1); add('5.mp4')
  segmentoAcelerado(p('6.mp4'), bases.tutorial, tutorialFator); add('6.mp4')
  // Os tres inserts do ensaio sao o pagamento do video — a 1s cada nao dava
  // tempo de olhar a foto antes de ela sumir.
  fotos.slice(1).forEach((f, i) => { segmentoDeFoto(p(`7${i}.mp4`), f, segundosPorInsert); add(`7${i}.mp4`) })
  segmentoDeVideo(p('8.mp4'), bases.cta, p('t-cta.png')); add('8.mp4')

  // Caminho absoluto: o concat resolve o que esta na lista em relacao a pasta
  // da PROPRIA lista, nao ao diretorio de trabalho. Com caminho relativo o
  // prefixo entrava duas vezes e o ffmpeg nao achava nada.
  writeFileSync(p('lista.txt'), partes.map((f) => `file '${resolve(f)}'`).join('\n'))
  // Reencoda em vez de copiar: com -c copy os segmentos entram com carimbos de
  // tempo proprios e o arquivo final fica com a duracao certa mas a linha de
  // tempo furada — seek e filtros so enxergavam o ultimo trecho. Reencodar
  // regenera os carimbos, e 24s custam poucos segundos de CPU.
  // Junta o video primeiro, sem som. As bases tem audio proprio e emendadas
  // dariam cinco cortes secos — por isso todo segmento sai mudo.
  const mudo = trilha ? p('mudo.mp4') : saida
  ff(['-f', 'concat', '-safe', '0', '-i', p('lista.txt'), ...PADRAO, '-movflags', '+faststart', mudo])

  if (trilha) {
    // Segunda passada so pro audio: o video e copiado, nao reencodado. O fade
    // de saida precisa do instante absoluto, e so da pra saber depois de medir.
    const d = duracao(mudo)
    const fim = Math.max(0, d - 1.2)
    ff(['-i', mudo, '-i', trilha, '-map', '0:v', '-map', '1:a',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100',
        '-af', `afade=t=in:st=0:d=0.4,afade=t=out:st=${fim.toFixed(2)}:d=1.2`,
        '-shortest', '-movflags', '+faststart', saida])
  }

  // Capa do grid: a foto heroina com a arte da marca por cima. Sem ela o
  // Instagram escolhe um quadro qualquer do video, e o primeiro quadro e a
  // personagem de camiseta preta — nao diz nada sobre o post.
  let capa
  if (arteCapa) {
    capa = saida.replace(/\.mp4$/, '-capa.jpg')
    const fundo = await sharp(fotos[0]).resize(L, A, { fit: 'cover' }).toBuffer()
    const arte = await sharp(arteCapa).resize(L, A, { fit: 'cover' }).png().toBuffer()
    // JPEG, nao PNG: a Meta baixa a capa e um PNG de 1080x1920 passa de 2MB
    // sem ganho nenhum numa imagem que e foto.
    await sharp(fundo).composite([{ input: arte, top: 0, left: 0 }]).jpeg({ quality: 90 }).toFile(capa)
  }

  return { video: saida, capa }
}
