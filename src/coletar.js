import { pathToFileURL } from 'node:url'
import { cfg, exigir } from './config.js'
import { conceitoDeReferencia } from './referencias.js'
import * as fila from './fila.js'

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

/** Falha de rede se resolve tentando de novo; falha de conteudo, nao. */
const transitorio = (e) =>
  /fetch failed|terminated|ECONN|ETIMEDOUT|socket|network|429|50\d\b/i.test(e.message)

/**
 * Baixa a imagem do pin com repeticao. O CDN do Pinterest derruba conexao
 * sob rajada, e uma tentativa unica perdia dois tercos dos pins.
 */
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
      await pausa(800 * (i + 1)) // recuo progressivo
    }
  }
  throw ultimo
}

/** Puxa os pins dos boards configurados. */
async function buscarPins(boards, maxPins = 50) {
  const r = await fetch(
    `https://api.apify.com/v2/acts/${cfg.apifyActor}/run-sync-get-dataset-items?token=${cfg.apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardUrls: boards, maxPins }),
    },
  )
  if (!r.ok) throw new Error(`Apify ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

export async function coletar() {
  exigir('apifyToken', 'boards')
  const boards = cfg.boards.split(',').map((b) => b.trim()).filter(Boolean)

  console.log(`Boards: ${boards.length}`)
  const pins = await buscarPins(boards)
  console.log(`Pins encontrados: ${pins.length}`)

  const d = fila.ler()
  const novos = pins.filter((p) => !fila.jaProcessado(d, p.id))
  console.log(`Novos (nao processados): ${novos.length}\n`)

  let adiados = 0

  for (const [i, pin] of novos.entries()) {
    // O CDN do Pinterest corta a conexao quando recebe uma rajada. Um
    // respiro entre pins vale mais que qualquer retry depois.
    if (i) await pausa(400)

    try {
      const { buf, mime } = await baixarImagem(pin.imageUrl)
      const conceito = await conceitoDeReferencia(buf, mime)
      fila.enfileirar(d, { ...conceito, saves: pin.saves, imagemRef: pin.imageUrl }, pin.id)
      console.log(`  + ${conceito.slug}  (${pin.saves} saves)`)
    } catch (e) {
      if (transitorio(e)) {
        // NAO marca como processado: falha de rede nao e culpa do pin, e
        // marcar aqui o descartaria para sempre. Fica para a proxima coleta.
        adiados++
        console.log(`  ~ pin ${pin.id} adiado (${e.message})`)
      } else {
        // Falha do proprio conteudo: nao adianta insistir.
        console.log(`  ! pin ${pin.id} descartado: ${e.message}`)
        d.processados.push(pin.id)
      }
    }
  }

  if (adiados) console.log(`\n${adiados} pin(s) adiados por rede — rode de novo para recuperar.`)

  fila.gravar(d)
  console.log(`\nFila: ${d.fila.length} conceitos (${d.fila.length} dias de conteudo)`)
  return d
}

// pathToFileURL: o caminho tem espacos, comparar string crua nunca casa
if (import.meta.url === pathToFileURL(process.argv[1]).href) await coletar()
