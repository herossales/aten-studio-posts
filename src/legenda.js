import { GoogleGenAI } from '@google/genai'
import { cfg, exigir } from './config.js'
import { extrairJson } from './referencias.js'

const INSTRUCAO = `Voce escreve a legenda de um post do @atenstudio.ai, um
estudio de imagem por IA. O post entrega um prompt pronto pra quem quiser usar.

=== COMECE PELA REFERENCIA ===
Olhe a imagem anexa. Ela quase sempre cita algo que a pessoa reconhece: uma
serie, um filme, uma capa, uma estetica com dono. Descubra o que e — e escreva
A PARTIR disso.

E o pulo do gato da legenda. Dizer "retrato conceitual com luz suave" nao
prende ninguem; dizer "esse prompt e Ruptura inteira em uma foto" prende.
Se voce genuinamente nao reconhecer nada, comente o efeito visual — mas
procure de verdade antes de desistir.

=== A VOZ ===
Escreva como o estagiario do estudio comentando o proprio trabalho: alguem
que sabe o que esta fazendo, esta empolgado com o resultado, e comenta com
graca — sem virar piada e sem perder a compostura de quem trabalha ali.

  Divertido e:   observacao esperta, um exagero comedido, admitir o obvio
                 com humor, cutucar de leve quem esta lendo
  Divertido nao e: meme, gritaria, ironia acida, "kkkk", girias forcadas,
                 emoji espalhado, autodepreciacao

Mantenha a formalidade: frases inteiras, pontuacao correta, portugues
cuidado. O humor esta na observacao, nao na escrita torta.

Exemplo do tom certo, pra um post que citava a serie Ruptura:
  "Sei que voce nao aguenta mais o trabalho. Mas pega esse prompt de Ruptura
   antes de bater o ponto."

=== O QUE ESCREVER ===
De 2 a 4 linhas curtas. Fale da referencia e do que o prompt entrega. Se as
personalidades do carrossel derem uma boa observacao, use — com naturalidade,
sem listar todo mundo.

=== O ERRO QUE VOCE NAO PODE COMETER ===
Nao existiu producao nenhuma. Ninguem ajustou luz, dirigiu ator, montou set
ou escolheu lente: isto e um prompt rodando num modelo. Toda frase do tipo
"levamos a expressao ao pe da letra", "ajustamos a iluminacao para", "buscamos
o contraste entre" e mentira e soa falsa.
Fale do PROMPT e da REFERENCIA, nunca do trabalho de estudio.

Tecnicalidade de fotografia (nome de lente, temperatura de cor, esquema de
luz) tambem fica de fora: o publico quer o prompt, nao a ficha tecnica.

=== PROIBIDO ===
- hashtag (entra depois, automatico)
- chamada para acao ou pedido de comentario (entra depois, automatico)
- emoji
- comecar com "Quando", "Aquele momento" ou "POV"
- dizer que foi feito por IA como se fosse desculpa

Responda em JSON, sem nada antes ou depois:
{
  "referencia": "o que a imagem cita, ou null se nao reconheceu",
  "legenda": "o texto, com quebras de linha reais onde fizer sentido"
}`

/**
 * Escreve a legenda do post.
 *
 * Roda na publicacao e nao na coleta porque depende do elenco escalado no
 * dia — a observacao boa costuma vir de quem apareceu no carrossel.
 *
 * Recebe a imagem do pin: e o unico jeito de reconhecer a referencia
 * cultural. O texto da analise descreve luz e enquadramento, nunca a obra
 * citada, e era dai que vinha a legenda generica e tecnica demais.
 */
export async function escreverLegenda({
  promptBase,
  etiqueta,
  gancho,
  figuras = [],
  referencia,
  referenciaCultural,
}) {
  exigir('geminiKey')
  const ai = new GoogleGenAI({ apiKey: cfg.geminiKey })

  const briefing = [
    etiqueta ? `TIPO DE ENSAIO: ${etiqueta}` : '',
    referenciaCultural ? `REFERENCIA JA IDENTIFICADA PELO DIRETOR DE ELENCO: ${referenciaCultural}` : '',
    `DIRECAO DE ARTE: ${promptBase}`,
    figuras.length ? `QUEM APARECE NO CARROSSEL: ${figuras.join(', ')}` : '',
    gancho ? `ANGULO JA PENSADO (pode usar ou ignorar): ${gancho}` : '',
    referencia ? 'A IMAGEM ANEXA E A REFERENCIA ORIGINAL DO ENSAIO.' : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const partes = []
  if (referencia) {
    partes.push({
      inlineData: { mimeType: referencia.mime, data: referencia.buffer.toString('base64') },
    })
  }
  partes.push({ text: `${INSTRUCAO}\n\n---\n\n${briefing}` })

  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{ role: 'user', parts: partes }],
    config: { responseMimeType: 'application/json' },
  })

  const { legenda } = extrairJson(r.text)
  if (!legenda?.trim()) throw new Error('legenda vazia')
  return legenda.trim()
}
