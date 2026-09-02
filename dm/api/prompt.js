// Endpoint chamado pelo External Request do ManyChat.
//
// Descobre em qual post a pessoa comentou e devolve o prompt daquele post.
// A fonte e o proprio fila.json do repo publico — nao ha banco nem copia:
// o que foi publicado ja esta la, e o campo `permalink` e a chave.

const FILA = 'https://raw.githubusercontent.com/herossales/aten-studio-posts/main/fila.json'
const API = 'https://graph.facebook.com/v21.0'

const limpar = (s) => String(s || '').trim().replace(/^@/, '').toLowerCase()

async function json(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url.split('?')[0]}`)
  return r.json()
}

/**
 * Acha o post pelo comentario mais recente do usuario.
 *
 * Plano B: so roda se o ManyChat nao mandar o post. Precisa do token, e por
 * isso e opcional — sem ele o endpoint ainda funciona pelo plano A e pelo C.
 */
async function porUsuario(usuario, publicados) {
  const t = process.env.META_ACCESS_TOKEN
  const u = process.env.IG_USER_ID
  if (!t || !u) return null

  const midia = await json(`${API}/${u}/media?fields=id,permalink,comments_count&limit=12&access_token=${t}`)
  // A lista vem do mais novo pro mais antigo: o primeiro que casar e o certo.
  for (const post of midia.data ?? []) {
    if (!post.comments_count) continue
    const c = await json(`${API}/${post.id}/comments?fields=username&access_token=${t}`)
    if ((c.data ?? []).some((x) => limpar(x.username) === usuario)) {
      return publicados.find((p) => p.permalink === post.permalink) ?? null
    }
  }
  return null
}

export default async function handler(req, res) {
  // Segredo compartilhado. So exige se estiver configurado, pra nao travar o
  // deploy inicial — mas configure: sem ele qualquer um consulta o endpoint.
  const segredo = process.env.SEGREDO
  if (segredo && req.headers['x-segredo'] !== segredo) {
    return res.status(401).json({ ok: false, erro: 'nao autorizado' })
  }

  try {
    const e = { ...(req.query ?? {}), ...(typeof req.body === 'object' ? req.body : {}) }
    const publicados = (await json(FILA)).publicados ?? []
    if (!publicados.length) return res.status(503).json({ ok: false, erro: 'fila vazia' })

    const permalink = String(e.permalink || e.post_url || '').split('?')[0].replace(/\/$/, '')
    const usuario = limpar(e.usuario || e.username || e.ig_username)

    // A: o ManyChat mandou o post. Exato, sem chamada extra.
    let post = permalink ? publicados.find((p) => p.permalink?.replace(/\/$/, '') === permalink) : null
    let como = 'permalink'

    // B: nao mandou, mas mandou quem comentou.
    if (!post && usuario) {
      post = await porUsuario(usuario, publicados)
      como = 'usuario'
    }

    // C: nem um nem outro. Quem comenta quase sempre esta no post mais novo,
    // entao devolver o ultimo erra pouco — e erra menos que nao responder.
    if (!post) {
      post = publicados.at(-1)
      como = 'ultimo-post'
    }

    const prompt = post.promptBase ?? ''
    const mensagem = [
      'Opa! Aqui esta o prompt do post que voce comentou:',
      '',
      prompt,
      '',
      'Troque [SUBJECT] pela pessoa ou personagem que quiser — e isso que faz o prompt render em serie.',
    ].join('\n')

    return res.status(200).json({
      ok: true,
      prompt,
      // O DM do Instagram corta em 1000 caracteres. Manda o texto ja pronto e
      // dentro do limite, pra ninguem receber prompt cortado no meio.
      mensagem: mensagem.length > 990 ? `Opa! Aqui esta o prompt:\n\n${prompt}` : mensagem,
      slug: post.slug ?? '',
      permalink: post.permalink ?? '',
      como, // como o post foi identificado — util pra depurar no ManyChat
    })
  } catch (err) {
    return res.status(500).json({ ok: false, erro: String(err.message ?? err) })
  }
}
