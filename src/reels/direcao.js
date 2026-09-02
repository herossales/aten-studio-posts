import { GoogleGenAI } from '@google/genai'
import { cfg, exigir } from '../config.js'
import { extrairJson } from '../referencias.js'

// A personagem dos Reels e uma mulher, sempre a mesma. O board de referencia
// nao sabe disso: tem foto de homem no meio, e uma direcao de arte que descreve
// terno e gravata aplicada a ela devolve resultado torto. Por isso a instrucao
// converte o guarda-roupa em vez de copiar, e proibe descrever a pessoa —
// o rosto vem da imagem de referencia dela, nao daqui.
const INSTRUCAO = `Voce e diretor de fotografia. Recebe uma imagem de referencia
e extrai dela a DIRECAO DE ARTE — nunca a pessoa.

=== REGRA 1: A PESSOA NAO ENTRA ===
Nao descreva rosto, corpo, idade, etnia, cabelo, expressao nem identidade de
quem aparece na imagem. Esses dados chegam de outro lugar. Se a sua descricao
permitir reconhecer a pessoa da referencia, ela esta errada.

Descreva SO: cenario, luz, guarda-roupa, paleta e tratamento de cor, lente e
distancia, profundidade de campo, textura e clima.

=== REGRA 2: A FOTO SERA DE UMA MULHER ===
A referencia pode mostrar um homem. A foto final e SEMPRE de uma mulher.
Converta o guarda-roupa para o equivalente feminino em vez de copiar:

  terno com gravata        -> terno feminino alfaiataria, camisa de gola aberta
  camisa social masculina  -> camisa de seda ou blusa estruturada
  barba, cabelo curto      -> nao mencione, e caracteristica de pessoa
  sapato social masculino  -> equivalente feminino discreto

Mantenha o REGISTRO da roupa (formal, casual, esportivo, editorial) e a paleta.
Troque so o corte. Se a referencia ja for de mulher, mantenha como esta.

=== REGRA 3: QUATRO POSES QUE FUNCIONEM ===
Devolva 4 poses distintas dentro do MESMO cenario e da MESMA luz: variam
enquadramento, angulo e atitude, nunca o lugar. A primeira e a principal —
aparece em destaque — entao deve ser a mais direta: peito pra cima, olhando
pra camera.

=== REGRA 4: O GANCHO ===
Duas linhas curtas em portugues do Brasil, que aparecem sobre o video.
A primeira e sempre "Foto com IA". A segunda completa em ate 4 palavras,
dizendo pra QUEM ou pra QUE serve — "para Advogado", "em Santorini",
"em preto e branco", "para o casamento".

Escreva a direcao de arte e as poses em INGLES; o gancho e a etiqueta em
portugues.

Responda em JSON, sem nada antes ou depois:
{
  "slug": "identificador-curto-em-kebab-case",
  "direcao": "a direcao de arte em 40 a 80 palavras, sem citar a pessoa",
  "poses": ["4 poses, uma por item, em ingles"],
  "gancho": { "linha1": "Foto com IA", "linha2": "complemento curto" },
  "etiqueta": "classificacao em ate 3 palavras",
  "faixa": "lifestyle | profissional | autoral"
}`

const FAIXAS_VALIDAS = new Set(['lifestyle', 'profissional', 'autoral'])

/**
 * Transforma um pin em direcao de arte pronta pros Reels.
 *
 * `faixaSugerida` vem do board de onde o pin saiu — o modelo pode discordar se
 * a imagem claramente pertence a outra gaveta, mas na duvida vale o board.
 */
export async function direcaoDeReferencia(buffer, mimeType = 'image/jpeg', faixaSugerida) {
  exigir('geminiKey')
  const ai = new GoogleGenAI({ apiKey: cfg.geminiKey })

  const dica = faixaSugerida
    ? `\n\nEste pin veio do board da faixa "${faixaSugerida}". Use essa faixa, a menos que a imagem claramente pertenca a outra.`
    : ''

  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType, data: buffer.toString('base64') } },
      { text: INSTRUCAO + dica },
    ] }],
    config: { responseMimeType: 'application/json' },
  })

  const d = extrairJson(r.text)
  if (!d.direcao || !Array.isArray(d.poses) || d.poses.length < 3) {
    throw new Error('direcao incompleta')
  }
  if (!FAIXAS_VALIDAS.has(d.faixa)) d.faixa = faixaSugerida || 'lifestyle'
  d.poses = d.poses.slice(0, 4)
  // Garante o padrao do gancho mesmo se o modelo improvisar a primeira linha.
  d.gancho = { linha1: 'Foto com IA', linha2: d.gancho?.linha2 || d.etiqueta || '' }
  return d
}
