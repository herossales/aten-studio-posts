import { pathToFileURL } from 'node:url'
import { cfg, exigir } from './config.js'
import { conceitoDeReferencia } from './referencias.js'
import * as fila from './fila.js'

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

  for (const pin of novos) {
    try {
      const img = await fetch(pin.imageUrl)
      if (!img.ok) throw new Error(`imagem ${img.status}`)
      const buf = Buffer.from(await img.arrayBuffer())
      const mime = img.headers.get('content-type') || 'image/jpeg'

      const conceito = await conceitoDeReferencia(buf, mime)
      fila.enfileirar(d, { ...conceito, saves: pin.saves, imagemRef: pin.imageUrl }, pin.id)
      console.log(`  + ${conceito.slug}  (${pin.saves} saves)`)
    } catch (e) {
      // Um pin ruim nao pode derrubar a coleta inteira
      console.log(`  ! pin ${pin.id} ignorado: ${e.message}`)
      d.processados.push(pin.id)
    }
  }

  fila.gravar(d)
  console.log(`\nFila: ${d.fila.length} conceitos (${d.fila.length} dias de conteudo)`)
  return d
}

// pathToFileURL: o caminho tem espacos, comparar string crua nunca casa
if (import.meta.url === pathToFileURL(process.argv[1]).href) await coletar()
