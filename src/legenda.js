import { GoogleGenAI } from '@google/genai'
import { cfg, exigir } from './config.js'
import { extrairJson } from './referencias.js'

const INSTRUCAO = `Voce escreve a legenda de um post do @atenstudio.ai, um
estudio de imagem por IA.

=== A VOZ ===
Escreva como o estagiario do estudio comentando o proprio trabalho: alguem
que sabe o que esta fazendo, esta empolgado com o resultado, e comenta com
graca — sem virar piada e sem perder a compostura de quem trabalha ali.

  Divertido e:   observacao esperta, um exagero comedido, um comentario
                 de bastidor, admitir o obvio com humor
  Divertido nao e: meme, gritaria, ironia acida, "kkkk", girias forcadas,
                 emoji espalhado, autodepreciacao

Mantenha a formalidade: frases inteiras, pontuacao correta, portugues
cuidado. O humor esta na observacao, nao na escrita torta.

=== O QUE ESCREVER ===
De 2 a 4 linhas curtas. Comente o ENSAIO: o que a direcao de arte faz, o
truque visual, ou o contraste entre o esforco aparente e o esforco real.
Se as personalidades do carrossel derem uma boa observacao, use — mas com
naturalidade, sem listar todo mundo.

=== PROIBIDO ===
- hashtag (entra depois, automatico)
- chamada para acao ou pedido de comentario (entra depois, automatico)
- emoji
- comecar com "Quando", "Aquele momento" ou "POV"
- dizer que foi feito por IA como se fosse desculpa

Responda em JSON, sem nada antes ou depois:
{ "legenda": "o texto, com quebras de linha reais onde fizer sentido" }`

/**
 * Escreve a legenda do post.
 *
 * Roda na publicacao e nao na coleta porque depende do elenco escalado no
 * dia — a observacao boa costuma vir de quem apareceu no carrossel.
 */
export async function escreverLegenda({ promptBase, etiqueta, gancho, figuras = [] }) {
  exigir('geminiKey')
  const ai = new GoogleGenAI({ apiKey: cfg.geminiKey })

  const briefing = [
    etiqueta ? `TIPO DE ENSAIO: ${etiqueta}` : '',
    `DIRECAO DE ARTE: ${promptBase}`,
    figuras.length ? `QUEM APARECE NO CARROSSEL: ${figuras.join(', ')}` : '',
    gancho ? `ANGULO JA PENSADO (pode usar ou ignorar): ${gancho}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: `${INSTRUCAO}\n\n---\n\n${briefing}`,
    config: { responseMimeType: 'application/json' },
  })

  const { legenda } = extrairJson(r.text)
  if (!legenda?.trim()) throw new Error('legenda vazia')
  return legenda.trim()
}
