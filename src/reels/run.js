import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FAIXAS, faixaDaHora } from './conceitos.js'
import { disponiveis } from './banco.js'
import { gerarFotosDoReel, carregarReferencia } from './fotos.js'
import { montarReel } from './montar.js'
import { publicarReel } from './publicar.js'
import { escreverLegenda } from '../legenda.js'
import { montarLegenda, marca } from '../brand.js'
import { gravarNoRepo } from '../storage.js'
import { cfg } from '../config.js'

const publicar = process.argv.includes('--publish')
// Reaproveita o video ja montado em vez de gerar tudo de novo. Serve pra
// retomar uma publicacao que falhou depois da montagem — sem isto, uma falha
// no upload custaria cinco geracoes pagas pra refazer o que ja estava pronto.
const reaproveitar = process.argv.includes('--reaproveitar')
const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null }

// Assets fixos. Fora do repo por padrao (sao ~30MB de video que nunca mudam);
// no runner o workflow baixa do Release e aponta BASES_DIR pra ca.
const BASES = process.env.BASES_DIR || 'Referencia Reels/Bases Reels'
const REF = process.env.REF_IMG || 'Referencia Reels/influencer/influencer-v1.png'
const TRILHAS = process.env.TRILHAS || `${BASES}/Trilhas`
const ARTE_CAPA = process.env.ARTE_CAPA || `${BASES}/Capa Reels.png`
const SELFIES = process.env.SELFIES || `${BASES}/Selfies`

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
  return [...disponiveis(faixa)].sort((a, b) => (usado.get(a.slug) ?? -1) - (usado.get(b.slug) ?? -1))[0]
}

const faixa = arg('--faixa') || faixaDaHora()
if (!FAIXAS[faixa]) throw new Error(`faixa desconhecida: ${faixa}`)

const estado = ler()
const conceito = proximo(faixa, estado)
console.log(`\nFaixa: ${faixa}`)
console.log(`Conceito: ${conceito.slug} [${conceito.origem}] — "${conceito.gancho.linha1} ${conceito.gancho.linha2}"\n`)

const video = `out/reels/reel-${conceito.slug}.mp4`
const capaPronta = video.replace(/\.mp4$/, '-capa.jpg')
const reusar = reaproveitar && existsSync(video)

let capa
if (reusar) {
  capa = existsSync(capaPronta) ? capaPronta : undefined
  console.log(`Reaproveitando ${video}${capa ? ' + capa' : ''}\n`)
} else {

const referencia = carregarReferencia(REF)

console.log('1. Gerando as fotos dela...')
// Tres poses, nao quatro: a que ela aponta e a mesma que abre os inserts do
// final, e tambem vira a capa. Reaproveitar em tres lugares custa uma geracao
// so — e a diferenca visual entre quatro e tres fotos no fim e nenhuma.
const fotos = await gerarFotosDoReel({
  direcao: conceito.direcao,
  poses: conceito.poses.slice(0, 3),
  referencia,
})
console.log(`  ${fotos.length} do ensaio`)

const tmp = `out/reels/${conceito.slug}`
mkdirSync(tmp, { recursive: true })
const arqs = fotos.map((b, i) => {
  const a = `${tmp}/foto-${i + 1}.png`
  writeFileSync(a, b)
  return a
})
// A selfie do "antes" nao e gerada: e sempre a mesma pessoa tirando selfie em
// casa, entao um acervo fixo entrega a mesma coisa de graca. Roda pelo total
// ja publicado pra nao cair sempre na mesma.
const acervo = readdirSync(SELFIES).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
if (!acervo.length) throw new Error(`nenhuma selfie em ${SELFIES}`)
const selfieEscolhida = acervo[estado.publicados.length % acervo.length]
const arqSelfie = join(SELFIES, selfieEscolhida)
console.log(`  selfie do acervo: ${selfieEscolhida}`)

const trilhas = readdirSync(TRILHAS).filter((f) => /\.(mp3|m4a|aac|wav)$/i.test(f)).sort()
if (!trilhas.length) throw new Error(`nenhuma trilha em ${TRILHAS}`)
// Deslocado em relacao a selfie: com 7 de cada, o mesmo indice faria a mesma
// selfie sair sempre com a mesma musica, e o par nunca mudaria.
const trilha = trilhas[(estado.publicados.length + 3) % trilhas.length]
console.log(`  trilha: ${trilha}`)

console.log('\n2. Montando o Reel...')
;({ capa } = await montarReel({
  bases: {
    gancho: `${BASES}/01 - Influencer - Gancho.mp4`,
    aponta: `${BASES}/02 - Influencer - Aponta Modelo.mp4`,
    selfie: `${BASES}/03 - Influencer - Selfie.mp4`,
    tutorial: `${BASES}/Tutorial Ferramenta - 02.mp4`,
    cta: `${BASES}/04 - Influencer - Finalização CTA.mp4`,
  },
  fotos: arqs,
  selfie: arqSelfie,
  gancho: conceito.gancho,
  textoSelfie: 'Tire uma selfie',
  cta: { linha1: 'Comenta PROMPT', linha2: 'e receba na DM' },
  trilha: join(TRILHAS, trilha),
  arteCapa: ARTE_CAPA,
  // Sem aceleracao: o tutorial ja esta em 7,3s, contra 22,9s da primeira
  // versao. Acelerar agora atropelaria o pouco que ele mostra.
  tutorialFator: 1,
  // 1,5s por insert. A 1s nao dava tempo de olhar; a 2,5s o final arrastava.
  segundosPorInsert: 1.5,
  saida: video,
  tmp: `${tmp}/montagem`,
}))
console.log(`  ${video}`)
}

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
  capa,
  legenda,
  audioName: marca.nomeDoAudio,
  colaboradores: marca.colaboradores,
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
