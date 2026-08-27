import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { marca } from './brand.js'

const L = 1080
const A = 1350

// As artes sao PNGs fechados (gradiente + letreiro + arroba) desenhados
// fora daqui. Le uma vez por arquivo e reusa entre laminas e execucoes.
const cache = new Map()

function carregarArte(arquivo) {
  if (cache.has(arquivo)) return cache.get(arquivo)

  const caminho = fileURLToPath(new URL(`../${arquivo}`, import.meta.url))
  if (!existsSync(caminho)) {
    // Falha alto de proposito: publicar sem a marca e pior que nao publicar.
    throw new Error(
      `Arte nao encontrada: ${arquivo}\n` +
        `Esperada em ${caminho}. Ajuste src/brand.js.`,
    )
  }
  const buf = readFileSync(caminho)
  cache.set(arquivo, buf)
  return buf
}

// O Nano Banana as vezes devolve a foto com uma moldura escura fina de alguns
// pixels — inconsistente, as vezes so de um lado. Como o cover pra 4:5 quase
// nao corta na horizontal, ela sobrevive e aparece como risco escuro na borda
// do post. Corta a moldura, mas com teto: se o trim quiser levar muito, a
// borda escura e a propria foto (cena noturna, vinheta) e nao se mexe.
//
// threshold 30, nao 12: a moldura nao e preta pura, sai como (1,12,4) —
// um preto esverdeado que passa batido num limiar apertado.
const TETO_MOLDURA = 0.04 // no maximo 4% de cada dimensao

async function tirarMoldura(buffer) {
  try {
    const { width, height } = await sharp(buffer).metadata()
    const { data, info } = await sharp(buffer)
      .trim({ background: '#000000', threshold: 30 })
      .toBuffer({ resolveWithObject: true })

    const exagerou =
      width - info.width > width * TETO_MOLDURA ||
      height - info.height > height * TETO_MOLDURA
    return exagerou ? buffer : data
  } catch {
    // trim falha quando a imagem inteira e uniforme. Segue com a original.
    return buffer
  }
}

// A arte do rodape termina em y=1228; abaixo disso sobra faixa livre. A
// etiqueta vai ali, centrada, classificando o prompt em ate 3 palavras.
const BASE_DA_ETIQUETA = 1288

const escapar = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function svgEtiqueta(texto) {
  return Buffer.from(`
    <svg width="${L}" height="${A}" xmlns="http://www.w3.org/2000/svg">
      <text x="${L / 2}" y="${BASE_DA_ETIQUETA}" text-anchor="middle"
            font-family="${marca.fonte}" font-size="30" font-weight="500"
            letter-spacing="5" fill="${marca.corTexto}"
            opacity="0.92">${escapar(texto.toUpperCase())}</text>
    </svg>`)
}

/**
 * Aplica uma arte de marca por cima da foto.
 *
 * Toda tipografia vem pronta do PNG — nada e desenhado aqui e nada e
 * gerado por IA. Pra conta de estudio, consistencia visual e o produto:
 * o letreiro sai identico todo dia porque e sempre o mesmo arquivo.
 */
export async function aplicarArte(buffer, arquivo, etiqueta = '') {
  // Redimensiona a arte caso um dia venha noutro tamanho.
  const arte = await sharp(carregarArte(arquivo))
    .resize(L, A, { fit: 'cover' })
    .png()
    .toBuffer()

  const camadas = [{ input: arte, top: 0, left: 0 }]
  if (etiqueta) camadas.push({ input: svgEtiqueta(etiqueta), top: 0, left: 0 })

  return sharp(await tirarMoldura(buffer))
    .resize(L, A, { fit: 'cover' })
    .composite(camadas)
    .png()
    .toBuffer()
}

/**
 * Alinha o balanco de cor entre as laminas do carrossel.
 *
 * Modelo de difusao nao tem controle deterministico de grade: a mesma
 * direcao de arte volta ora quente ora fria, e as palavras de cor da
 * descricao do sujeito ("warm skin", "pale") vazam pra imagem inteira.
 * Pedir mais firme nao resolve — medimos e continua variando.
 *
 * Entao corrige depois, que e o que um fotografo faria na pos: calcula a
 * mediana de cada canal no conjunto e puxa cada lamina pra ela. Aplica so
 * GANHO por canal, preservando a luminancia de cada imagem — assim iguala
 * temperatura sem achatar o contraste proprio de cada foto.
 */
export async function igualarGrade(buffers) {
  if (buffers.length < 2) return buffers

  const medias = await Promise.all(
    buffers.map(async (b) => (await sharp(b).stats()).channels.slice(0, 3).map((c) => c.mean)),
  )

  const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const alvo = [0, 1, 2].map((c) => mediana(medias.map((m) => m[c])))
  const alvoMedio = (alvo[0] + alvo[1] + alvo[2]) / 3

  return Promise.all(
    buffers.map((b, i) => {
      const m = medias[i]
      const medio = (m[0] + m[1] + m[2]) / 3
      // razao do canal no alvo dividida pela razao no original: so o desvio
      // de cor e corrigido, o brilho geral de cada lamina fica de pe.
      const ganho = [0, 1, 2].map((c) => alvo[c] / alvoMedio / (m[c] / medio))
      return sharp(b).linear(ganho, [0, 0, 0]).png().toBuffer()
    }),
  )
}

/** Laminas do meio: so normaliza o tamanho, sem arte. */
export const normalizar = async (buffer) =>
  sharp(await tirarMoldura(buffer)).resize(L, A, { fit: 'cover' }).png().toBuffer()
