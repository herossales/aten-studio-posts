import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { cfg, exigir } from '../config.js'

const GH = 'https://api.github.com'
const TAG = 'reels-staging'

const gh = (caminho, opcoes = {}) =>
  fetch(caminho.startsWith('http') ? caminho : `${GH}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `token ${cfg.ghToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aten-studio',
      ...opcoes.headers,
    },
  })

/**
 * Publica o video num Release e devolve a URL.
 *
 * A Meta baixa o arquivo uma vez na criacao do container e nunca mais precisa
 * dele — entao isto e entrega, nao hospedagem. Release em vez de commit
 * porque binario commitado fica no historico do git para sempre.
 */
export async function subirParaRelease(arquivo) {
  let r = await gh(`/repos/${cfg.ghRepo}/releases/tags/${TAG}`)
  let release = r.ok ? await r.json() : null
  if (!release) {
    r = await gh(`/repos/${cfg.ghRepo}/releases`, {
      method: 'POST',
      body: JSON.stringify({ tag_name: TAG, name: 'Reels staging', prerelease: true,
        body: 'Area temporaria: o Instagram baixa o video daqui ao criar o container.' }),
    })
    if (!r.ok) throw new Error(`release: ${r.status} ${await r.text()}`)
    release = await r.json()
  }

  const nome = basename(arquivo)
  // Um asset por nome: sem isto o upload falha com 422 na segunda vez.
  for (const a of release.assets ?? []) {
    if (a.name === nome) await gh(`/repos/${cfg.ghRepo}/releases/assets/${a.id}`, { method: 'DELETE' })
  }

  const up = `${release.upload_url.split('{')[0]}?name=${encodeURIComponent(nome)}`
  r = await gh(up, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: readFileSync(arquivo) })
  if (!r.ok) throw new Error(`upload: ${r.status} ${await r.text()}`)
  return (await r.json()).browser_download_url
}

export async function apagarDoRelease(arquivo) {
  const r = await gh(`/repos/${cfg.ghRepo}/releases/tags/${TAG}`)
  if (!r.ok) return
  const nome = basename(arquivo)
  for (const a of (await r.json()).assets ?? []) {
    if (a.name === nome) await gh(`/repos/${cfg.ghRepo}/releases/assets/${a.id}`, { method: 'DELETE' })
  }
}

const meta = (caminho, campos) =>
  fetch(`${cfg.api}/${caminho}`, {
    method: 'POST',
    body: new URLSearchParams({ ...campos, access_token: cfg.metaToken }),
  }).then(async (r) => {
    const j = await r.json()
    if (j.error) throw new Error(`${j.error.message} (código ${j.error.code})`)
    return j
  })

/**
 * Espera o container ficar pronto.
 *
 * Video demora bem mais que imagem — medido, ~20s para 24 segundos de Reel.
 * Publicar antes do FINISHED devolve "Media ID is not available".
 */
async function esperarPronto(id, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetch(`${cfg.api}/${id}?fields=status_code,status&access_token=${cfg.metaToken}`)
    const { status_code, status } = await r.json()
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`container ${status_code}: ${status}`)
    await new Promise((s) => setTimeout(s, 5000))
  }
  throw new Error('container nao ficou pronto a tempo')
}

/**
 * Publica um Reel. Diferente do carrossel: um container so, com video_url.
 *
 * `audio_name` nomeia a trilha embutida — e o que faz todos os Reels caírem na
 * mesma pagina de audio da conta. A API nao permite escolher som do Instagram
 * em nenhum formato, e Reel nao aceita troca de audio depois de publicado.
 */
export async function publicarReel({ arquivo, legenda, audioName }) {
  exigir('igUserId', 'metaToken', 'ghToken', 'ghRepo')

  const videoUrl = await subirParaRelease(arquivo)
  console.log(`  no ar para a Meta baixar: ${videoUrl}`)

  const { id } = await meta(`${cfg.igUserId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: legenda,
    share_to_feed: 'true',
    ...(audioName ? { audio_name: audioName } : {}),
  })
  console.log(`  container ${id}, processando...`)
  await esperarPronto(id)

  const { id: mediaId } = await meta(`${cfg.igUserId}/media_publish`, { creation_id: id })
  const r = await fetch(`${cfg.api}/${mediaId}?fields=permalink&access_token=${cfg.metaToken}`)
  const { permalink } = await r.json()

  // O arquivo ja cumpriu o papel: a Meta baixou e guardou. Nao deixa lixo.
  await apagarDoRelease(arquivo)
  return { mediaId, permalink }
}
