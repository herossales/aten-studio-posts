import { pathToFileURL } from 'node:url'
import { cfg, exigir } from '../config.js'
import { direcaoDeReferencia } from './direcao.js'
import * as banco from './banco.js'

// Um board por faixa. O board diz de que gaveta o pin e; a analise so
// confirma ou corrige.
export const BOARDS = {
  profissional: 'https://www.pinterest.com/heros27ar/poses-profissionais-femininas/',
  lifestyle: 'https://www.pinterest.com/heros27ar/ensaios-life-style-femininas/',
  autoral: 'https://www.pinterest.com/heros27ar/posts-aten-studio/',
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
const transitorio = (e) => /fetch failed|terminated|ECONN|ETIMEDOUT|socket|network|429|50\d\b/i.test(e.message)

/** O CDN do Pinterest derruba conexao sob rajada; tentativa unica perde pins. */
async function baixarImagem(url, tentativas = 3) {
  let ultimo
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!r.ok) throw new Error(`imagem ${r.status}`)
      return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || 'image/jpeg' }
    } catch (e) {
      ultimo = e
      if (!transitorio(e)) throw e
      await pausa(800 * (i + 1))
    }
  }
  throw ultimo
}

async function pinsDoBoard(url, maxPins) {
  const r = await fetch(
    `https://api.apify.com/v2/acts/${cfg.apifyActor}/run-sync-get-dataset-items?token=${cfg.apifyToken}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardUrls: [url], maxPins }) },
  )
  if (!r.ok) throw new Error(`Apify ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

export async function coletarReels({ maxPorBoard = 20 } = {}) {
  exigir('apifyToken', 'geminiKey')
  const b = banco.ler()
  let novos = 0

  for (const [faixa, url] of Object.entries(BOARDS)) {
    console.log(`\n=== ${faixa} ===`)
    let pins
    try {
      pins = await pinsDoBoard(url, maxPorBoard)
    } catch (e) {
      // Um board fora do ar nao pode derrubar a coleta dos outros.
      console.log(`  ! board indisponivel (${e.message})`)
      continue
    }
    const inedito = pins.filter((p) => !banco.jaProcessado(b, p.id))
    console.log(`  ${pins.length} pins, ${inedito.length} novos`)

    for (const pin of inedito) {
      try {
        const { buf, mime } = await baixarImagem(pin.imageUrl)
        const d = await direcaoDeReferencia(buf, mime, faixa)
        banco.guardar(b, { ...d, imagemRef: pin.imageUrl }, pin.id)
        novos++
        console.log(`  + ${d.slug} [${d.faixa}] — "${d.gancho.linha1} ${d.gancho.linha2}"`)
      } catch (e) {
        // Falha de rede volta na proxima coleta; falha de conteudo nao vale
        // gastar de novo, entao marca como visto.
        if (transitorio(e)) console.log(`  ~ ${pin.id}: adiado (${e.message})`)
        else { b.processados.push(pin.id); console.log(`  x ${pin.id}: ${e.message}`) }
      }
    }
  }

  banco.gravar(b)
  const porFaixa = Object.keys(BOARDS).map((f) => `${f}=${b.conceitos.filter((c) => c.faixa === f).length}`)
  console.log(`\n${novos} conceitos novos. Banco: ${porFaixa.join('  ')}`)
  return b
}

// pathToFileURL: o caminho tem espacos, comparar string crua nunca casa.
if (import.meta.url === pathToFileURL(process.argv[1]).href) await coletarReels()
