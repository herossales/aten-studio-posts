import { readFileSync } from 'node:fs'
import { GoogleGenAI } from '@google/genai'
import { cfg, exigir } from '../config.js'

// Nano Banana 2 em vez do Pro: metade do preco por imagem ($0.067 contra
// $0.134 a 1K) e a identidade dela se mantem igual. O Nano Banana 2.5, mais
// barato ainda, foi testado e reprovado — o rosto deriva, e num formato que
// depende de ser sempre a mesma pessoa isso invalida o post.
const MODELO = 'gemini-3.1-flash-image'

// O Reel inteiro depende disso: ela tira a selfie, o app transforma, o
// resultado aparece. Se o rosto do resultado nao for o dela, a demonstracao
// nao demonstra nada. A referencia entra em TODA geracao, nao so na primeira.
const IDENTIDADE =
  'The woman in the attached reference image is the subject of this photograph. ' +
  'Keep her identity exactly: the same face, the same wild red curls, the same ' +
  'bright blue eyes, the same freckles, the same fair skin tone. She must be ' +
  'immediately recognisable as the same person. Change her clothing, pose, ' +
  'setting and lighting as described below — never her face.\n\n' +
  // O Nano Banana 2 copiou o gesto de maos abertas da referencia em vez de
  // seguir a pose pedida. A referencia existe para o ROSTO; tudo o mais nela
  // e ruido que precisa ser dito explicitamente para ser ignorado.
  'Use the attached image ONLY as a facial identity reference. Ignore ' +
  'everything else about it: ignore its pose, its hand gestures, its framing, ' +
  'its clothing, its background and its lighting. Those come exclusively from ' +
  'the art direction and the pose described in this prompt.'

const FOTOREALISMO =
  'This is a real photograph captured on a physical camera. It is NOT an ' +
  'illustration, NOT a render, NOT digital art. There is absolutely no text, ' +
  'no lettering, no logo and no watermark anywhere in the image.'

/**
 * Gera as fotos do "depois" do Reel, todas da mesma pessoa.
 *
 * A primeira e a heroina: aparece em quadrado enquanto ela aponta, depois em
 * tela cheia. As demais fecham a demonstracao, 1s cada.
 */
export async function gerarFotosDoReel({ direcao, poses, referencia }) {
  exigir('geminiKey')
  const ai = new GoogleGenAI({ apiKey: cfg.geminiKey })
  const ref = { inlineData: { mimeType: referencia.mime, data: referencia.buffer.toString('base64') } }

  const uma = async (pose, i) => {
    const texto = [`${direcao}\n\nPose and framing: ${pose}`, IDENTIDADE, FOTOREALISMO].join('\n\n')
    const r = await ai.models.generateContent({
      model: MODELO,
      contents: [{ role: 'user', parts: [ref, { text: texto }] }],
      config: {
        responseModalities: ['IMAGE'],
        // imageSize 2K devolve 1536x2752. Sem ele vem 768x1376, e o Reel e
        // 1080x1920 — a foto era ampliada 1,4x e o zoom dos inserts esticava
        // pixel em cima disso. Com 2K a montagem passa a REDUZIR, que e onde
        // imagem nao perde. Cuidado: `resolution` e ignorado em silencio, o
        // nome do campo e imageSize mesmo.
        imageConfig: { aspectRatio: '9:16', imageSize: '2K' },
      },
    })
    const parte = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
    if (!parte) throw new Error(`foto ${i + 1}: ${r.candidates?.[0]?.finishReason || 'sem imagem'}`)
    return Buffer.from(parte.inlineData.data, 'base64')
  }

  // Em paralelo: sao independentes entre si, todas ancoradas na mesma referencia.
  return Promise.all(poses.map(uma))
}

export const carregarReferencia = (caminho) => ({
  buffer: readFileSync(caminho),
  mime: caminho.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
})
