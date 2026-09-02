import { readFileSync } from 'node:fs'
import { GoogleGenAI } from '@google/genai'
import { cfg, exigir } from '../config.js'

const MODELO = 'gemini-3-pro-image'

// O Reel inteiro depende disso: ela tira a selfie, o app transforma, o
// resultado aparece. Se o rosto do resultado nao for o dela, a demonstracao
// nao demonstra nada. A referencia entra em TODA geracao, nao so na primeira.
const IDENTIDADE =
  'The woman in the attached reference image is the subject of this photograph. ' +
  'Keep her identity exactly: the same face, the same wild red curls, the same ' +
  'bright blue eyes, the same freckles, the same fair skin tone. She must be ' +
  'immediately recognisable as the same person. Change her clothing, pose, ' +
  'setting and lighting as described below — never her face.'

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
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
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
