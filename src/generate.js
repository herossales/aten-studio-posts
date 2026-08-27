import { GoogleGenAI } from '@google/genai'
import { cfg, exigir } from './config.js'

// Pro: texto melhor e consistencia de estilo entre laminas.
// Trocar por 'gemini-2.5-flash-image' se o custo apertar.
const MODELO = 'gemini-3-pro-image'

// O SDK documenta só 1:1/3:4/4:3/9:16/16:9, mas a doc do Nano Banana Pro
// anuncia 4:5. Tentamos o ideal e caimos no mais proximo se ele recusar.
// De qualquer forma o compose.js normaliza tudo pra 1080x1350.
const PROPORCOES = ['4:5', '3:4', '1:1']

let proporcaoOk = null // memoriza a primeira que funcionar

// Vale pra todo prompt, venha do banco local ou de referencia do Pinterest.
// A direcao de arte do proprio prompt tem precedencia: se ela pedir uma
// composicao descentrada de proposito, e ela que manda. O padrao so cobre
// o caso em que o prompt nao disse nada sobre enquadramento — que era o
// motivo das pessoas sairem jogadas pro canto.
const ENQUADRAMENTO =
  'Framing: compose for a vertical 4:5 crop. Place the subject centered in ' +
  'the frame with balanced headroom, fully inside the frame, with nothing ' +
  'important cut off by the edges. Leave the lower third calmer and less ' +
  'busy. If the art direction above explicitly calls for a different ' +
  'composition, follow the art direction instead.'

// Sem isto, nome proprio de pessoa real empurra a saida pra ilustracao ou
// poster, muitas vezes com o nome escrito na arte. Com a clausula, o nome
// entrega a semelhanca e a foto continua foto.
// Sem isto, adjetivo de cor no sujeito ("warm caramel skin", "pale", "blue
// eyes") escapa da pele e vira grade da foto inteira. Medido: era a maior
// fonte de variacao de temperatura entre laminas.
const GRADE_FIXA =
  'The colour grade, white balance and colour temperature of this photograph ' +
  'are fixed by the art direction above and must NOT be influenced by the ' +
  'subject. Any colour word describing the person (their skin tone, hair, ' +
  'eyes or clothing) applies ONLY to that person, never to the overall grade ' +
  'of the image. A warm-skinned subject and a pale-skinned subject must come ' +
  'out on exactly the same grade.'

const FOTOREALISMO =
  'This is a real photograph captured on a physical camera. It is NOT an ' +
  'illustration, NOT a drawing, NOT a painting, NOT a poster, NOT digital art, ' +
  'NOT a render. There is absolutely no text, no lettering, no title, no ' +
  'caption, no logo and no watermark anywhere in the image.'

// A foto original do pin entra como referencia de acabamento. O risco e ele
// copiar a PESSOA da referencia em vez do sujeito pedido — dai a instrucao
// separar explicitamente o que herdar do que ignorar.
const REFERENCIA =
  'The attached image is the STYLE MASTER for this photograph. Reproduce it ' +
  'faithfully: same colour grade, same contrast and tonal range, same black ' +
  'level, same lighting direction and quality, same lens character, same ' +
  'subject distance and crop, same density and layering of the background ' +
  'elements, same overall photographic finish. Treat every one of these as a ' +
  'requirement, not a suggestion — the output must look like it came from the ' +
  'same shoot as the attached image. ' +
  'TWO EXCEPTIONS, and only these two: (1) the person at the centre is NOT ' +
  'the person in the attached image — it is the one named in the text above, ' +
  'and only that one; (2) ignore any text, lettering, logo, watermark or ' +
  'interface element in the attached image, and never reproduce it.'

// Modo serie: a lamina 1 vira a mestra das demais. Diferente da referencia
// do pin — aqui o objetivo nao e herdar acabamento, e ser o mesmo ensaio com
// outra pessoa no centro. Custo: a consistencia passa a depender de um anexo
// que quem compra o prompt nao recebe.
const SERIE =
  'The attached image is the MASTER FRAME of this series. Reproduce it: same ' +
  'framing and crop, same background, same number, arrangement, density and ' +
  'depth of the surrounding elements, same lighting setup, same colour grade, ' +
  'same white balance, same lens character and subject distance. ' +
  'Change exactly ONE thing: the person at the centre is now the one named in ' +
  'the text above. Re-light that new face naturally within the same lighting ' +
  'setup — this is another shot from the same session, not a face pasted onto ' +
  'the old frame, so the head pose and the fall of light on the features may ' +
  'differ slightly as they would between two frames. Everything around the ' +
  'person stays put. Ignore and never reproduce any text, logo or watermark ' +
  'present in the attached image.'

async function umaImagem(ai, promptDaArte, referencia) {
  // O enquadramento entra depois da arte pra ficar claro quem tem precedencia.
  const papel = referencia ? (referencia.papel === 'serie' ? SERIE : REFERENCIA) : ''
  const texto = referencia
    ? `${promptDaArte}\n\n${papel}\n\n${GRADE_FIXA}\n\n${FOTOREALISMO}\n\n${ENQUADRAMENTO}`
    : `${promptDaArte}\n\n${GRADE_FIXA}\n\n${FOTOREALISMO}\n\n${ENQUADRAMENTO}`

  const contents = referencia
    ? [{ inlineData: { mimeType: referencia.mime, data: referencia.buffer.toString('base64') } }, { text: texto }]
    : texto

  const tentativas = proporcaoOk ? [proporcaoOk] : PROPORCOES
  let ultimoErro

  for (const aspectRatio of tentativas) {
    try {
      const r = await ai.models.generateContent({
        model: MODELO,
        contents,
        config: {
          responseModalities: ['IMAGE'],
          // personGeneration existe nos tipos (compartilhados com Vertex)
          // mas a Developer API rejeita o campo.
          imageConfig: { aspectRatio },
        },
      })

      const parte = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
      if (!parte) {
        const motivo = r.candidates?.[0]?.finishReason || 'sem inlineData'
        throw new Error(`sem imagem na resposta (${motivo})`)
      }

      if (!proporcaoOk) {
        proporcaoOk = aspectRatio
        if (aspectRatio !== PROPORCOES[0])
          console.log(`  (4:5 recusado, usando ${aspectRatio} + corte no compose)`)
      }
      return Buffer.from(parte.inlineData.data, 'base64')
    } catch (e) {
      ultimoErro = e
      if (!/aspect|ratio|invalid/i.test(e.message)) throw e // erro real, nao de proporcao
    }
  }
  throw new Error(`Nano Banana falhou: ${ultimoErro?.message}`)
}

/**
 * Encaixa o sujeito no prompt.
 *
 * A analise de referencia costuma devolver o prompt com o marcador
 * [SUBJECT] no meio da frase. Anexar "Sujeito: X" no fim deixava o
 * marcador cru chegando no modelo de imagem. Se ele existe, substitui;
 * se nao, anexa como antes.
 */
const comSujeito = (base, sujeito) =>
  /\[SUBJECT\]/i.test(base)
    ? base.replace(/\[SUBJECT\]/gi, sujeito)
    : `${base}\n\nSujeito: ${sujeito}`

/**
 * Gera as laminas. A 1 e o hero (para o scroll); as demais reusam o
 * MESMO promptBase trocando so o sujeito — e isso que prova pra quem
 * ve que o prompt e reaproveitavel.
 */
export async function gerarLaminas({ promptBase, variacoes, assinatura, elenco, referencia, encadear }) {
  exigir('geminiKey')
  const ai = new GoogleGenAI({ apiKey: cfg.geminiKey })

  // Se o sujeito for recusado, tenta de novo com o arquetipo generico. Uma
  // lamina a menos quebraria o carrossel inteiro por causa de um sujeito so.
  // Sem imagem de referencia entre as laminas, de proposito: a consistencia
  // tem que vir do PROMPT, que e o que o comprador leva. Se ela viesse de um
  // anexo, o carrossel mostraria um resultado que ninguem consegue repetir.
  const comReserva = async (sujeito, rotulo, ref) => {
    try {
      return await umaImagem(ai, comSujeito(promptBase, sujeito), ref)
    } catch (e) {
      if (!/recusad|safety|prohibit|sem imagem/i.test(e.message) || !assinatura) throw e
      console.log(`  ~ ${rotulo}: sujeito recusado, repetindo com o arquetipo`)
      return umaImagem(ai, comSujeito(promptBase, assinatura), ref)
    }
  }

  // Com elenco escalado, ele define todas as laminas — a primeira inclusive.
  // Sem elenco, cai no comportamento antigo: arquetipo no hero, variacoes atras.
  const sujeitos = elenco?.length ? elenco : [assinatura || 'a person', ...variacoes]

  const hero = await comReserva(sujeitos[0], 'lamina 1', referencia)
  console.log('  lamina 1 (hero) pronta')

  // No modo encadeado as demais herdam o hero, nao o pin — e sempre o hero,
  // nunca a lamina anterior, senao o desvio se acumula ao longo do carrossel.
  const refDemais = encadear
    ? { buffer: hero, mime: 'image/png', papel: 'serie' }
    : referencia
  if (encadear) console.log('  (demais laminas encadeadas na lamina 1)')

  const laminas = [hero]
  for (const [i, s] of sujeitos.slice(1).entries()) {
    laminas.push(await comReserva(s, `lamina ${i + 2}`, refDemais))
    console.log(`  lamina ${i + 2} pronta — ${s.slice(0, 60)}...`)
  }
  return laminas
}
