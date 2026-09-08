/* ============================================================================
   COLETA
   Lê os comentários das últimas publicações, separa quem escreveu a chave e
   resolve @ → nome + foto.

   Nada de raspar seguidores: além de violar os termos e a LGPD, a entrada por
   consentimento é melhor para o objetivo — a pessoa PEDIU para aparecer, o
   post vira máquina de comentário, e quem aparece compartilha.
============================================================================ */
import { midias, comentarios, descobrir, perfil } from './instagram.js';
import { CHAVE } from './narracao.js';

/* A chave tem duas palavras, e duas palavras são mais frágeis que uma: as
   pessoas escrevem "Eu determino!", "#EuDetermino", "eu determino 🚀". Compara
   sem acento, sem caixa e sem pontuação — e também sem espaço nenhum, senão
   "EuDetermino" grudado escaparia. */
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normal = s => semAcento(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const grudado = s => normal(s).replace(/ /g, '');

const CHAVE_SOLTA = normal(CHAVE);
const CHAVE_GRUDADA = grudado(CHAVE);

export const bateChave = texto =>
  normal(texto).includes(CHAVE_SOLTA) || grudado(texto).includes(CHAVE_GRUDADA);

/* Teto de consultas de perfil por rodada. business_discovery é uma chamada por
   pessoa; sem teto, um dia muito bom estoura o limite da API e derruba a
   rodada inteira. Quem sobrar entra na próxima. */
const TETO_PERFIS = 300;

export async function coletar(estado, { posts = 12, silencioso = false } = {}) {
  const eu = (await perfil()).username.toLowerCase();
  const dentro = new Set(estado.participantes.map(p => p.username.toLowerCase()));
  const vistos = new Set();
  const candidatos = [];

  for (const m of await midias(posts)) {
    for (const c of await comentarios(m.id)) {
      const u = (c.username || '').toLowerCase();
      if (!u || u === eu) continue;              // a própria conta não entra
      if (!bateChave(c.text || '')) continue;
      if (dentro.has(u) || vistos.has(u)) continue;
      vistos.add(u);
      candidatos.push({ username: u, comentario: c.id, quando: c.timestamp, post: m.id });
    }
  }

  // ordem de chegada: quem comentou primeiro entra primeiro
  candidatos.sort((a, b) => new Date(a.quando) - new Date(b.quando));
  const lote = candidatos.slice(0, TETO_PERFIS);

  let comFoto = 0;
  for (const p of lote) {
    const d = await descobrir(p.username);
    p.nome = d?.nome || null;
    p.foto = d?.foto || null;
    p.seguidores = d?.seguidores ?? null;
    if (p.foto) comFoto++;
  }

  if (!silencioso) {
    console.log(`coleta: ${candidatos.length} novos` +
      (candidatos.length > lote.length ? ` (${lote.length} nesta rodada, resto na próxima)` : '') +
      ` · ${comFoto} com foto, ${lote.length - comFoto} com iniciais`);
  }
  return lote;
}
