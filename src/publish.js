import { cfg, exigir } from './config.js'

const post = async (caminho, params) => {
  const r = await fetch(`${cfg.api}/${caminho}`, {
    method: 'POST',
    body: new URLSearchParams({ ...params, access_token: cfg.metaToken }),
  })
  const j = await r.json()
  if (j.error) throw new Error(`Meta: ${j.error.message} (code ${j.error.code})`)
  return j
}

/**
 * O container do carrossel leva alguns segundos processando. Publicar
 * antes de ficar FINISHED devolve "Media ID is not available" (9007).
 */
async function esperarPronto(containerId, tentativas = 30) {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetch(
      `${cfg.api}/${containerId}?fields=status_code&access_token=${cfg.metaToken}`,
    )
    const { status_code } = await r.json()
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR' || status_code === 'EXPIRED')
      throw new Error(`container ${containerId} terminou em ${status_code}`)
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`container ${containerId} nao ficou pronto a tempo`)
}

/** Cria um container filho do carrossel a partir de uma URL publica. */
const criarFilho = (imageUrl) =>
  post(`${cfg.igUserId}/media`, { image_url: imageUrl, is_carousel_item: 'true' })

/**
 * Publica um carrossel. `urls` sao HTTPS publicas e precisam continuar
 * no ar ate o publish terminar. A API aceita de 2 a 10 laminas.
 */
export async function publicarCarrossel(urls, legenda) {
  exigir('igUserId', 'metaToken')
  if (urls.length < 2 || urls.length > 10)
    throw new Error(`Carrossel aceita 2-10 laminas, recebi ${urls.length}`)

  const filhos = []
  for (const url of urls) {
    const { id } = await criarFilho(url)
    filhos.push(id)
    console.log(`  lamina ${filhos.length}/${urls.length} → ${id}`)
  }

  const pai = await post(`${cfg.igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: filhos.join(','),
    caption: legenda,
    // Autodeclaracao de IA. Vai SO no container pai: a doc da Meta diz que
    // por no filho devolve erro. Desde 31/08/2026 conteudo com pessoas
    // geradas por IA sem rotulo perde alcance e sai das recomendacoes.
    is_ai_generated: 'true',
  })
  console.log(`  container pai → ${pai.id}`)

  await esperarPronto(pai.id)
  console.log('  container pronto')

  const { id: mediaId } = await post(`${cfg.igUserId}/media_publish`, {
    creation_id: pai.id,
  })

  const r = await fetch(
    `${cfg.api}/${mediaId}?fields=permalink&access_token=${cfg.metaToken}`,
  )
  const { permalink } = await r.json()
  return { mediaId, permalink }
}

/** Quantos posts ainda cabem na janela de 24h (limite Meta: 50). */
export async function cotaRestante() {
  const r = await fetch(
    `${cfg.api}/${cfg.igUserId}/content_publishing_limit?access_token=${cfg.metaToken}`,
  )
  const j = await r.json()
  return 50 - (j.data?.[0]?.quota_usage ?? 0)
}
