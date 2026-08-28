import { GoogleGenAI } from '@google/genai'
import { cfg, exigir } from './config.js'
import { extrairJson } from './referencias.js'
import { marca } from './brand.js'

const INSTRUCAO = `Voce e diretor de elenco. Recebe a direcao de arte de um
ensaio fotografico e decide QUEM aparece nele.

=== REGRA 0: LEIA A REFERENCIA ANTES DE ESCALAR ===
Se vier uma imagem junto, olhe primeiro. Ela costuma citar algo reconhecivel —
uma serie, um filme, uma capa de disco, uma estetica com dono. Identifique o
que e ANTES de escolher qualquer nome.

Reconheceu? O elenco sai de dentro daquele universo, nesta ordem:
  1. o proprio elenco da obra citada
  2. quem estrelou obras do mesmo tema (ex: se a referencia fala de mente e
     realidade, gente de "A Origem", "Clube da Luta", "Matrix")
  3. so entao a regra geral abaixo

Isso e o que faz o post conversar com a referencia em vez de so imitar a luz.

=== REGRA 1: A BARRA DE FAMA ===
O elenco existe pra ancorar o olhar em quem o publico reconhece NO PRIMEIRO
SEGUNDO. Nome que precisa de explicacao nao ancora nada.

Ordem de preferencia, sempre nesta ordem:
  1. ESTRELA GLOBAL de primeira grandeza — Hollywood, pop internacional,
     esporte mundial. Reconhecivel em qualquer pais.
  2. BRASILEIRO, e SOMENTE se estiver comprovadamente em alta AGORA. Use a
     busca e confirme presenca no noticiario das ultimas semanas antes de
     escalar. Sem prova recente, nao entra.

NUNCA escale: nome consagrado porem fora de evidencia; celebridade regional;
figura de nicho; alguem cuja fama venha sobretudo de TV aberta brasileira.
Veterano respeitado sem noticia recente e exatamente o caso a evitar.
Na duvida entre um brasileiro morno e uma estrela global, escolha a global.

Para CINEMA e TV a regra e dura: personalidades globais, padrao Hollywood.
Brasileiro nessa categoria so com prova de alta no noticiario recente.

=== REGRA 2: CASE A CATEGORIA COM O TEMA ===
  politica, eleicao, poder     -> figuras publicas da politica em evidencia
  cinema, serie, TV            -> estrelas globais de Hollywood
  musica, palco, show          -> artistas no topo das paradas mundiais
  esporte, competicao          -> atletas em destaque na temporada
  praia, sensual, fitness      -> sex symbols internacionais do momento
  moda, luxo, editorial        -> modelos e it-girls de circulacao global
  negocios, tecnologia         -> fundadores e executivos conhecidos
  humor, internet              -> criadores e comediantes de alcance global
Se o tema nao encaixar em nenhuma, escolha a categoria que der a ancoragem
visual mais forte.

=== REGRA 3: NOME + TRACOS, OS DOIS JUNTOS ===
O nome ancora a semelhanca. Os tracos seguram o fotorrealismo e cobrem o caso
de o modelo conhecer pouco aquela pessoa. Sozinho, cada um falha: so o nome
tende a virar ilustracao, so os tracos perdem a semelhanca.

  Formato: "<Nome>, <o que a pessoa e> (<tracos fisicos concretos>)"
  Exemplo: "Neymar, the Brazilian footballer (a lean athletic man in his
            thirties, sharp jawline, short bleached-blond hair with dark
            roots, light stubble, tattooed forearms, confident half-smile)"

=== REGRA 4: O ELENCO PRECISA CABER NA MESMA FOTO ===
As 5 pessoas serao fotografadas com a MESMA direcao de arte, mesma luz e mesmo
cenario. Escolha gente que faz sentido naquele cenario. Devem ser visualmente
DISTINTAS entre si (idade, genero, tipo fisico, cabelo) pra o carrossel nao
parecer a mesma pessoa cinco vezes.
Nao descreva luz, fundo, lente ou clima — isso ja vem da direcao de arte e
descrever de novo faz cada lamina divergir. Descreva SO a pessoa.

Responda em JSON, sem nada antes ou depois:
{
  "categoria": "a categoria escolhida",
  "referencia": "a obra ou estetica que a imagem cita, ou null se nao houver",
  "justificativa": "uma linha dizendo por que cada escolha esta em alta agora",
  "elenco": ["5 entradas no formato nome + tracos, em INGLES, uma por pessoa"],
  "figuras": ["os 5 nomes correspondentes, so como anotacao, em ordem"]
}`

/**
 * Escala 5 figuras publicas em evidencia que combinem com a direcao de arte.
 *
 * Roda na hora de gerar, nao na coleta: quem esta em alta muda por semana e
 * um conceito pode ficar dias parado na fila antes de ir ao ar.
 *
 * A imagem do pin entra no briefing porque so o texto nao basta — a analise
 * da referencia descreve a luz e o enquadramento, nunca "isto e Ruptura".
 * Sem ver, o diretor nao tem como puxar o elenco do universo certo.
 */
export async function escalarElenco({ promptBase, gancho, assinatura, referencia, vetados = [] }) {
  exigir('geminiKey')
  const ai = new GoogleGenAI({ apiKey: cfg.geminiKey })

  const bloqueadas = marca.categoriasBloqueadas ?? []
  const veto = bloqueadas.length
    ? `\n\n=== CATEGORIAS PROIBIDAS ===\nNAO escale ninguem destas categorias: ${bloqueadas.join(', ')}.\n` +
      `Se o tema do ensaio cair numa delas, escolha a categoria adjacente mais\n` +
      `forte visualmente (ex: em vez de politicos, jornalistas e apresentadores).`
    : ''

  // Sem isto o modelo converge sempre nos mesmos poucos nomes: a barra de fama
  // alta deixa o conjunto de candidatos obvios pequeno, e ele nao lembra dos
  // posts anteriores. O veto amplia a busca a forca.
  const repetidos = vetados.length
    ? `\n\n=== JA APARECERAM NOS ULTIMOS POSTS — PROIBIDO REPETIR ===\n` +
      `${vetados.join(', ')}.\n` +
      `Nenhum destes pode entrar. Ha estrela global de sobra: se o primeiro nome\n` +
      `que te veio a cabeca esta na lista, procure outro do mesmo calibre em vez\n` +
      `de baixar a barra de fama.`
    : ''

  const briefing = [
    `DIRECAO DE ARTE: ${promptBase}`,
    gancho ? `TEMA DO POST: ${gancho}` : '',
    assinatura ? `TIPO QUE A REFERENCIA ORIGINAL RETRATAVA: ${assinatura}` : '',
    referencia ? 'A IMAGEM ANEXA E A REFERENCIA ORIGINAL DO ENSAIO. Leia antes de escalar.' : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const partes = []
  if (referencia) {
    partes.push({
      inlineData: { mimeType: referencia.mime, data: referencia.buffer.toString('base64') },
    })
  }
  partes.push({ text: `${INSTRUCAO}${veto}${repetidos}\n\n---\n\n${briefing}` })

  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{ role: 'user', parts: partes }],
    // Busca ligada: sem grounding ele escala por memoria de treino e erra
    // quem esta em alta. Com googleSearch a API recusa responseMimeType json,
    // entao o JSON sai no meio do texto e o extrator pesca.
    config: { tools: [{ googleSearch: {} }] },
  })

  const dados = extrairJson(r.text)
  if (!Array.isArray(dados.elenco) || dados.elenco.length < 2) {
    throw new Error('elenco incompleto')
  }

  // O veto e instrucao, nao garantia — o modelo as vezes repete assim mesmo.
  // Avisa em vez de derrubar: elenco quase certo vale mais que post nenhum.
  const proibidos = new Set(vetados.map((v) => v.toLowerCase()))
  const furos = (dados.figuras ?? []).filter((f) => proibidos.has(String(f).toLowerCase()))
  if (furos.length) dados.furos = furos

  return dados
}
