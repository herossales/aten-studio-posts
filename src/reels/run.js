import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FAIXAS, faixaDaHora } from './conceitos.js'
import { gerarFotosDoReel, carregarReferencia } from './fotos.js'
import { montarReel } from './montar.js'
import { publicarReel } from './publicar.js'
import { escreverLegenda } from '../legenda.js'
import { montarLegenda, marca } from '../brand.js'
import { gravarNoRepo } from '../storage.js'
import { cfg } from '../config.js'

const publicar = process.argv.includes('--publish')
const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null }

// Assets fixos. Fora do repo por padrao (sao ~30MB de video que nunca mudam);
// no runner o workflow baixa do Release e aponta BASES_DIR pra ca.
const BASES = process.env.BASES_DIR || 'Referencia Reels/Bases Reels'
const REF = process.env.REF_IMG || 'Referencia Reels/influencer/influencer-v1.png'
const TRILHA = process.env.TRILHA || `${BASES}/Musicas/Audio 01.MP3`

// Relativo ao modulo: rodar de outra pasta lia um historico vazio e repetia
// o mesmo conceito todo dia.
const ESTADO = fileURLToPath(new URL('../../reels.json', import.meta.url))
const ler = () => (existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : { publicados: [] })

/**
 * Proximo conceito da faixa: o que faz mais tempo que nao vai ao ar.
 *
 * Sem indice fixo de proposito — acrescentar conceito no meio do banco nao
 * pode bagunçar a ordem de quem ja rodou.
 */
function proximo(faixa, estado) {
  const usado = new Map()
  estado.publicados.forEach((p, i) => usado.set(p.slug, i))
  return [...FAIXAS[faixa]].sort((a, b) => (usado.get(a.slug) ?? -1) - (usado.get(b.slug) ?? -1))[0]
}

const faixa = arg('--faixa') || faixaDaHora()
if (!FAIXAS[faixa]) throw new Error(`faixa desconhecida: ${faixa}`)

const estado = ler()
const conceito = proximo(faixa, estado)
console.log(`\nFaixa: ${faixa}`)
console.log(`Conceito: ${conceito.slug} — "${conceito.gancho.linha1} ${conceito.gancho.linha2}"\n`)

const referencia = carregarReferencia(REF)

console.log('1. Gerando as fotos dela...')
const [fotos, selfie] = await Promise.all([
  gerarFotosDoReel({ direcao: conceito.direcao, poses: conceito.poses, referencia }),
  gerarFotosDoReel({ direcao: conceito.selfie.direcao, poses: [conceito.selfie.pose], referencia }),
])
console.log(`  ${fotos.length} do ensaio + 1 selfie`)

const tmp = `out/reels/${conceito.slug}`
mkdirSync(tmp, { recursive: true })
const arqs = fotos.map((b, i) => {
  const a = `${tmp}/foto-${i + 1}.png`
  writeFileSync(a, b)
  return a
})
const arqSelfie = `${tmp}/selfie.png`
writeFileSync(arqSelfie, selfie[0])

console.log('\n2. Montando o Reel...')
const video = `out/reels/reel-${conceito.slug}.mp4`
await montarReel({
  bases: {
    gancho: `${BASES}/01 - Influencer - Gancho.mp4`,
    aponta: `${BASES}/02 - Influencer - Aponta Modelo.mp4`,
    selfie: `${BASES}/03 - Influencer - Selfie.mp4`,
    tutorial: `${BASES}/06 - Tutorial APP.mp4`,
    cta: `${BASES}/04 - Influencer - Finalização CTA.mp4`,
  },
  fotos: arqs,
  selfie: arqSelfie,
  gancho: conceito.gancho,
  textoSelfie: 'Tire uma selfie',
  cta: { linha1: 'Comenta PROMPT', linha2: 'e receba na DM' },
  trilha: TRILHA,
  tutorialFator: 2,
  saida: video,
  tmp: `${tmp}/montagem`,
})
console.log(`  ${video}`)

let texto = `${conceito.gancho.linha1} ${conceito.gancho.linha2}.`
try {
  texto = await escreverLegenda({
    promptBase: conceito.direcao,
    etiqueta: faixa,
    gancho: `${conceito.gancho.linha1} ${conceito.gancho.linha2}`,
  })
} catch (e) {
  console.log(`  ! legenda automatica falhou (${e.message}), usando o gancho`)
}
const legenda = montarLegenda({ texto, hashtags: marca.hashtagsPadrao })

if (!publicar) {
  console.log('\n--- LEGENDA ---')
  console.log(legenda)
  console.log('\nNada publicado. Rode com --publish.\n')
  process.exit(0)
}

console.log('\n3. Publicando...')
const { permalink } = await publicarReel({
  arquivo: video,
  legenda,
  audioName: marca.nomeDoAudio,
})

// So agora entra no historico: se qualquer passo acima falhar, o conceito
// continua sendo o mais antigo e a proxima execucao tenta de novo.
estado.publicados.push({
  slug: conceito.slug, faixa, permalink, publicadoEm: new Date().toISOString(),
})
writeFileSync(ESTADO, JSON.stringify(estado, null, 2))

if (cfg.ghToken && cfg.ghRepo) {
  try {
    await gravarNoRepo('reels.json', JSON.stringify(estado, null, 2), `reels: publicado ${conceito.slug}`)
    console.log('  historico persistido no repo')
  } catch (e) {
    console.error(`\n  ATENCAO: Reel no ar mas o historico nao persistiu (${e.message}).`)
  }
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `permalink=${permalink}\nslug=${conceito.slug}\nfaixa=${faixa}\n`)
}
console.log(`\nNo ar: ${permalink}\n`)
