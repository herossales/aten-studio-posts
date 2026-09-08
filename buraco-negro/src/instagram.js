/* ============================================================================
   INSTAGRAM — Graph API

   Só existe o que foi verificado contra a API de verdade. Em especial: NÃO há
   lista de seguidores em nenhuma versão, com nenhum token. Quem só segue e
   observa é invisível. Aparece quem age — e aqui, quem comenta a chave.
============================================================================ */
import { env } from './config.js';

const API = 'https://graph.facebook.com/v21.0';

const token = () => {
  const t = env('META_ACCESS_TOKEN');
  if (!t) throw new Error('META_ACCESS_TOKEN ausente — veja o .env');
  return t;
};
export const contaId = () => {
  const i = env('IG_USER_ID');
  if (!i) throw new Error('IG_USER_ID ausente — veja o .env');
  return i;
};

async function get(caminho, campos = {}) {
  const q = new URLSearchParams({ ...campos, access_token: token() });
  const r = await fetch(`${API}/${caminho}?${q}`);
  const j = await r.json();
  if (j.error) {
    const e = new Error(`${j.error.message} (código ${j.error.code})`);
    e.codigo = j.error.code;
    throw e;
  }
  return j;
}

export async function post(caminho, campos) {
  const r = await fetch(`${API}/${caminho}`, {
    method: 'POST',
    body: new URLSearchParams({ ...campos, access_token: token() }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${j.error.message} (código ${j.error.code})`);
  return j;
}

/* ------------------------------- leitura -------------------------------- */

export const perfil = () =>
  get(contaId(), { fields: 'username,name,followers_count,media_count' });

/** Últimas publicações da conta — é nelas que os comentários chegam. */
export const midias = (limite = 12) =>
  get(`${contaId()}/media`, { fields: 'id,caption,timestamp,permalink', limit: String(limite) })
    .then(r => r.data || []);

/**
 * Todos os comentários de uma publicação, incluindo as RESPOSTAS.
 *
 * Sem pedir `replies` a API devolve só os comentários de primeiro nível — num
 * post real testado aqui, 8 de 13. Quem responde dentro de uma thread some, e
 * some justamente quem estava conversando, que é quem mais engaja.
 */
export async function comentarios(mediaId) {
  const saida = [];
  const CAMPOS = 'id,text,username,timestamp,replies{id,text,username,timestamp}';
  let pagina = await get(`${mediaId}/comments`, { fields: CAMPOS, limit: '50' });
  while (true) {
    for (const c of pagina.data || []) {
      saida.push(c);
      for (const r of c.replies?.data || []) saida.push(r);
    }
    const proxima = pagina.paging?.next;
    if (!proxima) break;
    const r = await fetch(proxima);
    pagina = await r.json();
    if (pagina.error) break;
  }
  return saida;
}

/**
 * Nome, foto e nº de seguidores de um @.
 *
 * Só responde para conta PROFISSIONAL (comercial ou criador). Conta pessoal
 * devolve erro — e isso não é exceção, é uma fatia relevante de qualquer
 * audiência. Devolve null em vez de estourar: quem não tem foto entra com as
 * iniciais, e o vídeo não quebra por causa de um participante.
 */
export async function descobrir(username) {
  try {
    const r = await get(contaId(), {
      fields: `business_discovery.username(${username})` +
              '{username,name,profile_picture_url,followers_count}',
    });
    const d = r.business_discovery;
    return d ? { username: d.username, nome: d.name || null,
                 foto: d.profile_picture_url || null, seguidores: d.followers_count ?? null } : null;
  } catch {
    return null;
  }
}

/* ------------------------------ publicação ------------------------------ */

export const criarContainer = campos =>
  post(`${contaId()}/media`, { media_type: 'REELS', ...campos });

/**
 * Espera o container ficar pronto.
 *
 * Vídeo demora bem mais que imagem — no projeto irmão, ~20s para um Reel de
 * 24s. Publicar antes do FINISHED devolve "Media ID is not available".
 */
export async function esperarContainer(id, tentativas = 90) {
  for (let i = 0; i < tentativas; i++) {
    const { status_code, status } = await get(id, { fields: 'status_code,status' });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`container ${status_code}: ${status}`);
    }
    await new Promise(s => setTimeout(s, 5000));
  }
  throw new Error('container não ficou pronto a tempo');
}

/**
 * Publica o container, com repetição.
 *
 * O `media_publish` devolve `Fatal (código -1)` de vez em quando com o
 * container já FINISHED e nada de errado — é erro transitório do lado da Meta.
 * Aconteceu na primeira publicação desta série. Sem repetir, um soluço do
 * servidor joga fora um vídeo que levou cinco minutos para ser gravado.
 */
export async function publicarContainer(creation_id, tentativas = 4) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try { return await post(`${contaId()}/media_publish`, { creation_id }); }
    catch (e) {
      ultimo = e;
      // erro de conteúdo não melhora com repetição; só o transitório melhora
      if (!/Fatal|temporar|try again|-1/i.test(e.message)) throw e;
      const espera = 8000 * (i + 1);
      console.log(`  publicação falhou (${e.message}); repetindo em ${espera/1000}s`);
      await new Promise(s => setTimeout(s, espera));
    }
  }
  throw ultimo;
}

/**
 * Lê de volta um campo do post publicado.
 *
 * A API ignora parâmetro desconhecido EM SILÊNCIO — no projeto irmão ela
 * aceitou até um nome de campo inventado. "Não deu erro" não é confirmação de
 * nada; confirmação é ler o valor de volta.
 */
export const conferir = (mediaId, campos) => get(mediaId, { fields: campos });
