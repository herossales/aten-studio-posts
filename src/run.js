import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import * as fila from './fila.js'
import { gerarLaminas } from './generate.js'
import { escalarElenco } from './elenco.js'
import { escreverLegenda } from './legenda.js'
import { aplicarArte, normalizar, igualarGrade } from './compose.js'
import { subir, gravarNoRepo } from './storage.js'
import { publicarCarrossel, cotaRestante } from './publish.js'
import { montarLegenda, marca } from './brand.js'
import { cfg } from './config.js'

const publicar = process.argv.includes('--publish')
// Fura a trava de intervalo. Pra republicar de proposito no mesmo dia.
const forcar = process.argv.includes('--forcar')

// A fila do Pinterest e a unica fonte de conteudo. Sem reserva local de
// proposito: publicar um conceito antigo mascara a fila vazia justamente
// no dia em que voce precisa saber que ela secou.
const dados = fila.ler()

const repetidos = fila.descartarJaPublicados(dados)
if (repetidos) {
  console.log(`${repetidos} conceito(s) ja publicado(s) descartado(s) da fila.`)
  fila.gravar(dados)
}

// Trava antes de qualquer geracao: dois agendadores apontando pro mesmo
// workflow disparam os dois, e sem isto o segundo gastaria cinco imagens pra
// so entao descobrir que o dia ja tinha post. Sai com 0 — nao e falha, e o
// comportamento correto do disparo redundante.
const desdeUltimo = fila.horasDesdeUltimoPost(dados)
if (publicar && !forcar && desdeUltimo < marca.horasEntrePosts) {
  console.log(
    `\nUltimo post foi ha ${desdeUltimo.toFixed(1)}h, ` +
      `abaixo da janela de ${marca.horasEntrePosts}h. Nada a fazer.`,
  )
  console.log('Use --forcar para publicar assim mesmo.\n')
  process.exit(0)
}

const conceito = fila.proximo(dados)

if (!conceito) {
  console.error('\nFila vazia — nenhum pin para publicar.')
  console.error('Rode `node src/coletar.js` para abastecer a partir dos boards.\n')
  // Sai com erro pra pintar o Actions de vermelho: e o aviso de fila seca.
  process.exit(1)
}

console.log(`\nConceito: ${conceito.slug}`)
if (conceito.assinatura) console.log(`Assinatura: ${conceito.assinatura}`)
console.log(`Laminas: ${conceito.variacoes.length + 1}`)
console.log(`Restam na fila: ${dados.fila.length}\n`)

// Carregada antes do elenco de proposito: o diretor e o redator precisam VER
// o pin. So o texto da analise nunca diz "isto e Ruptura" — descreve luz e
// enquadramento — e sem reconhecer a obra citada o elenco vira estrela global
// generica e a legenda vira ficha tecnica.
console.log('1. Carregando a referencia do pin...')
let referencia
if (conceito.imagemRef) {
  try {
    const r = await fetch(conceito.imagemRef)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    referencia = {
      buffer: Buffer.from(await r.arrayBuffer()),
      mime: r.headers.get('content-type') || 'image/jpeg',
    }
    console.log('  carregada')
  } catch (e) {
    console.log(`  ! indisponivel (${e.message}), seguindo so com o texto`)
  }
}

console.log('\n2. Escalando elenco (noticiario atual)...')
const vetados = fila.figurasRecentes(dados, marca.postsSemRepetirElenco)
if (vetados.length) console.log(`  vetados (${vetados.length}): ${vetados.join(', ')}`)

let elenco
let figuras = []
let referenciaCultural
try {
  const escalado = await escalarElenco({ ...conceito, referencia, vetados })
  elenco = escalado.elenco
  figuras = escalado.figuras ?? []
  referenciaCultural = escalado.referencia
  console.log(`  categoria: ${escalado.categoria}`)
  if (referenciaCultural) console.log(`  referencia: ${referenciaCultural}`)
  figuras.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
  // Nao derruba o post: o veto e instrucao, e o modelo as vezes fura. Mas
  // registra, pra dar pra ver se a lista esta sendo ignorada com frequencia.
  if (escalado.furos?.length) {
    console.log(`  ! repetiu mesmo com o veto: ${escalado.furos.join(', ')}`)
  }
} catch (e) {
  // Elenco e melhoria, nao requisito: sem ele o post sai com os sujeitos
  // genericos que a analise da referencia ja tinha proposto.
  console.log(`  ! falhou (${e.message}), seguindo com as variacoes do conceito`)
}

console.log('\n3. Gerando imagens (Nano Banana)...')
const brutas = await gerarLaminas({
  ...conceito,
  elenco,
  // Como anexo de geracao a referencia e opcional: melhora cor e acabamento,
  // mas parte do resultado deixa de vir do prompt que a pessoa recebe.
  referencia: marca.usarReferenciaDoPin ? referencia : undefined,
  encadear: marca.encadearNaPrimeira,
})

console.log('\n4. Compondo laminas...')
const niveladas = marca.nivelarGrade ? await igualarGrade(brutas) : brutas
const ultima = niveladas.length - 1
const laminas = await Promise.all(
  niveladas.map((b, i) => {
    if (i === 0) return aplicarArte(b, marca.rodape, conceito.etiqueta) // abre
    if (i === ultima) return aplicarArte(b, marca.cta) // fecha
    return normalizar(b)
  }),
)

// Sempre grava local: da pra revisar antes de publicar.
// A pasta esta no .gitignore, entao no runner do Actions ela nao existe —
// sem isto o writeFileSync quebra com ENOENT depois de gerar tudo.
mkdirSync('out', { recursive: true })
laminas.forEach((buf, i) => {
  const arq = `out/${conceito.slug}-${String(i + 1).padStart(2, '0')}.png`
  writeFileSync(arq, buf)
  console.log(`  ${arq}`)
})

let texto = conceito.gancho
try {
  texto = await escreverLegenda({ ...conceito, figuras, referencia, referenciaCultural })
} catch (e) {
  // Legenda e melhoria, nao requisito: sem ela usa o gancho da analise.
  console.log(`  ! legenda automatica falhou (${e.message}), usando o gancho`)
}

const legenda = montarLegenda({
  texto,
  hashtags: conceito.hashtags ?? marca.hashtagsPadrao,
})

if (!publicar) {
  console.log('\n--- LEGENDA ---')
  console.log(legenda)
  console.log('\nNada publicado. Rode com --publish quando estiver bom.\n')
  process.exit(0)
}

console.log('\n5. Subindo as laminas...')
const urls = await subir(laminas, `${conceito.slug}-${Date.now()}`)

console.log('\n6. Publicando...')
const cota = await cotaRestante()
if (cota < 1) throw new Error('Cota de 50 posts/24h esgotada')

const { permalink } = await publicarCarrossel(urls, legenda)

// So agora o conceito sai da fila — se qualquer passo acima falhar, ele
// continua na frente e a proxima execucao tenta de novo.
// figuras vao junto: e a partir delas que o proximo post monta o veto.
fila.marcarPublicado(dados, permalink, { figuras, referenciaCultural })
fila.gravar(dados)

if (cfg.ghToken && cfg.ghRepo) {
  try {
    await gravarNoRepo('fila.json', JSON.stringify(dados, null, 2), `fila: publicado ${conceito.slug}`)
    console.log('  fila persistida no repo')
  } catch (e) {
    // O post ja esta no ar: nao da pra desfazer. Grita, mas nao derruba —
    // e o descartarJaPublicados da proxima execucao cobre a repeticao.
    console.error(`\n  ATENCAO: post publicado mas a fila nao persistiu (${e.message}).`)
    console.error(`  Commite o fila.json manualmente para nao reprocessar ${conceito.slug}.`)
  }
}

// Entrega o resultado pro workflow: e com isso que ele monta o lembrete
// de musica e decide se a fila esta acabando.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `permalink=${permalink}\nrestam=${dados.fila.length}\nslug=${conceito.slug}\netiqueta=${conceito.etiqueta ?? ''}\n`,
  )
}

console.log(`\nNo ar: ${permalink}`)
console.log(`Restam na fila: ${dados.fila.length}`)
console.log('Abra o app e adicione o audio em trend.\n')
