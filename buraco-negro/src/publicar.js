/* ============================================================================
   PUBLICAÇÃO
   Release do GitHub como entrega do arquivo → container REELS → publish.

   Release e não commit: binário commitado fica no histórico do git para
   sempre. E isto não é hospedagem — a Meta baixa o arquivo UMA vez, ao criar
   o container, e nunca mais precisa dele. Por isso o asset é apagado no fim.
============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config.js';
import { marca } from './marca.js';
import { criarContainer, esperarContainer, publicarContainer, conferir } from './instagram.js';

const GH = 'https://api.github.com';
const TAG = 'buraco-negro-staging';

const repo = () => {
  const r = env('GH_REPO');
  if (!r) throw new Error('GH_REPO ausente — veja o .env');
  return r;
};

const gh = (caminho, opcoes = {}) =>
  fetch(caminho.startsWith('http') ? caminho : GH + caminho, {
    ...opcoes,
    headers: {
      Authorization: `token ${env('GH_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'buraco-negro',
      ...opcoes.headers,
    },
  });

async function release() {
  let r = await gh(`/repos/${repo()}/releases/tags/${TAG}`);
  if (r.ok) return r.json();
  r = await gh(`/repos/${repo()}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: TAG, name: 'Buraco Negro — entrega', prerelease: true,
      body: 'Área temporária: o Instagram baixa o vídeo daqui ao criar o container e depois o arquivo é apagado.',
    }),
  });
  if (!r.ok) throw new Error(`release: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function subir(arquivo, tipo = 'video/mp4') {
  const rel = await release();
  const nome = path.basename(arquivo);
  // Um asset por nome: sem apagar antes, o segundo upload falha com 422.
  for (const a of rel.assets ?? []) {
    if (a.name === nome) await gh(`/repos/${repo()}/releases/assets/${a.id}`, { method: 'DELETE' });
  }
  const url = `${rel.upload_url.split('{')[0]}?name=${encodeURIComponent(nome)}`;
  const r = await gh(url, { method: 'POST', headers: { 'Content-Type': tipo }, body: fs.readFileSync(arquivo) });
  if (!r.ok) throw new Error(`upload: ${r.status} ${await r.text()}`);
  return (await r.json()).browser_download_url;
}

export async function apagar(arquivo) {
  const r = await gh(`/repos/${repo()}/releases/tags/${TAG}`);
  if (!r.ok) return;
  const nome = path.basename(arquivo);
  for (const a of (await r.json()).assets ?? []) {
    if (a.name === nome) await gh(`/repos/${repo()}/releases/assets/${a.id}`, { method: 'DELETE' });
  }
}

/**
 * Cria o container tolerando colaborador que recusa.
 *
 * Convite de colaboração depende de configuração na conta do OUTRO: se ele
 * desligou "quem pode me convidar", a API responde `User not visible` e
 * derruba a publicação inteira. Um ajuste no perfil de terceiro não pode
 * impedir o post do dia — então na falha descobrimos quem aceita e seguimos
 * com esses. No dia em que ele religar, volta sozinho.
 */
async function containerTolerante(campos, colaboradores) {
  const lista = (colaboradores || []).slice(0, 3);
  if (!lista.length) return criarContainer(campos);
  try {
    return await criarContainer({ ...campos, collaborators: JSON.stringify(lista) });
  } catch (e) {
    if (!/not visible|collaborator/i.test(e.message)) throw e;
    console.log(`  ⚠ colaboração recusada (${e.message}); testando um a um`);
    const bons = [];
    for (const c of lista) {
      try { await criarContainer({ ...campos, collaborators: JSON.stringify([c]) }); bons.push(c); }
      catch { console.log(`  ⚠ @${c} não aceita convite de colaboração`); }
    }
    return bons.length
      ? criarContainer({ ...campos, collaborators: JSON.stringify(bons) })
      : criarContainer(campos);
  }
}

export async function publicarReel({ arquivo, legenda }) {
  const videoUrl = await subir(arquivo);
  console.log('  vídeo no ar para a Meta baixar');

  /* A Meta precisa BAIXAR esta URL. Se o repositório for privado, o link do
     asset exige autenticação e o container falha com uma mensagem que não diz
     isso. Conferir aqui custa uma requisição e economiza uma hora. */
  const teste = await fetch(videoUrl, { method: 'HEAD', redirect: 'follow' });
  if (!teste.ok) {
    await apagar(arquivo);
    throw new Error(`o asset do Release não é público (HTTP ${teste.status}). ` +
      `O repositório ${repo()} precisa ser público para a Meta baixar o vídeo.`);
  }

  const { id } = await containerTolerante({
    video_url: videoUrl,
    caption: legenda,
    share_to_feed: marca.reelNoFeed ? 'true' : 'false',
    ...(marca.audioName ? { audio_name: marca.audioName } : {}),
    ...(marca.declararIA ? { is_ai_generated: 'true' } : {}),
  }, marca.colaboradores);
  console.log(`  container ${id}, esperando processar`);
  await esperarContainer(id);

  const { id: mediaId } = await publicarContainer(id);
  await apagar(arquivo);

  /* A API ignora parâmetro desconhecido em silêncio — ela chegou a aceitar um
     nome de campo inventado no projeto irmão. "Não deu erro" não confirma
     nada: o que confirma é ler o valor de volta do post publicado. */
  let confirmado = {};
  try { confirmado = await conferir(mediaId, 'id,permalink,media_type,is_shared_to_feed,collaborators'); }
  catch { /* o post existe mesmo que a leitura de volta falhe */ }

  return { mediaId, ...confirmado };
}
