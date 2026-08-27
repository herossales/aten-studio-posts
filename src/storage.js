import { cfg, exigir } from './config.js'

/**
 * Hospeda as laminas no proprio repositorio via GitHub Contents API e
 * devolve URLs raw publicas.
 *
 * A API do Instagram so aceita HTTPS publico, e as imagens so precisam
 * ficar no ar durante o publish — depois o Instagram tem copia propria.
 * Usar o repo evita um servico a mais e ainda deixa o arquivo versionado
 * de tudo que ja foi publicado.
 *
 * Exige repositorio PUBLICO: raw de repo privado pede autenticacao e o
 * robo da Meta nao tem como autenticar.
 */
export async function subir(buffers, pastaSlug) {
  exigir('ghToken', 'ghRepo')
  const [dono, repo] = cfg.ghRepo.split('/')
  if (!repo) throw new Error(`GH_REPO deve ser "dono/repo", recebi "${cfg.ghRepo}"`)

  const urls = []
  for (const [i, buf] of buffers.entries()) {
    const caminho = `posts/${pastaSlug}/${String(i + 1).padStart(2, '0')}.png`
    await put(caminho, buf.toString('base64'), `carrossel: ${pastaSlug} lamina ${i + 1}`)

    urls.push(
      `https://raw.githubusercontent.com/${dono}/${repo}/${cfg.ghBranch}/${caminho}`,
    )
    console.log(`  subiu ${caminho}`)
  }

  // O raw tem CDN com atraso de alguns segundos apos o commit.
  await esperarDisponivel(urls[urls.length - 1])
  return urls
}

/** Escreve um arquivo no repo. Busca o sha antes: sem ele a API recusa sobrescrita. */
async function put(caminho, conteudoBase64, mensagem) {
  let sha
  const atual = await fetch(
    `https://api.github.com/repos/${cfg.ghRepo}/contents/${caminho}?ref=${cfg.ghBranch}`,
    { headers: { Authorization: `Bearer ${cfg.ghToken}` } },
  )
  if (atual.ok) sha = (await atual.json()).sha

  const r = await fetch(`https://api.github.com/repos/${cfg.ghRepo}/contents/${caminho}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfg.ghToken}`,
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      message: mensagem,
      content: conteudoBase64,
      branch: cfg.ghBranch,
      ...(sha && { sha }),
    }),
  })
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

/**
 * Persiste um arquivo de texto no repo.
 *
 * No GitHub Actions o disco e efemero: gravar a fila so em disco faz o
 * conceito publicado voltar pra fila na proxima execucao, e o mesmo pin
 * ir ao ar todo dia pra sempre.
 */
export async function gravarNoRepo(caminho, texto, mensagem) {
  exigir('ghToken', 'ghRepo')
  await put(caminho, Buffer.from(texto, 'utf8').toString('base64'), mensagem)
}

/** O raw.githubusercontent leva alguns segundos pra propagar. */
async function esperarDisponivel(url, tentativas = 10) {
  for (let i = 0; i < tentativas; i++) {
    if ((await fetch(url, { method: 'HEAD' })).ok) return
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`raw nao propagou a tempo: ${url}`)
}
