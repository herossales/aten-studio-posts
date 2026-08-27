import { readFileSync, readdirSync } from 'node:fs'
import { subir } from './src/storage.js'
import { publicarCarrossel, cotaRestante } from './src/publish.js'
import { montarLegenda } from './src/brand.js'
import { banco } from './src/prompts.js'

const conceito = banco.find((c) => c.slug === 'retrato-janela')
const arquivos = readdirSync('out')
  .filter((f) => f.startsWith('retrato-janela-') && f.endsWith('.png'))
  .sort()

console.log(`Lâminas: ${arquivos.join(', ')}\n`)
const buffers = arquivos.map((f) => readFileSync(`out/${f}`))

console.log('1. Subindo pro repo...')
const urls = await subir(buffers, `retrato-janela-${Date.now()}`)

console.log('\n2. Publicando...')
console.log(`   cota restante: ${await cotaRestante()}/50`)
const legenda = montarLegenda({
  gancho: conceito.gancho,
  prompt: conceito.promptBase,
  hashtags: conceito.hashtags,
})
const { mediaId, permalink } = await publicarCarrossel(urls, legenda)
console.log(`\nNO AR: ${permalink}`)
console.log(`media_id: ${mediaId}`)
