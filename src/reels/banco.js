import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FAIXAS } from './conceitos.js'

// Relativo ao modulo, nao ao cwd: rodar de outra pasta lia um banco vazio.
export const ARQ = fileURLToPath(new URL('../../reels-banco.json', import.meta.url))
const vazio = { processados: [], conceitos: [] }

export const ler = () =>
  existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, 'utf8')) : structuredClone(vazio)

export const gravar = (b) => writeFileSync(ARQ, JSON.stringify(b, null, 2))

export const jaProcessado = (b, pinId) => b.processados.includes(pinId)

export function guardar(b, conceito, pinId) {
  b.processados.push(pinId)
  b.conceitos.push({ ...conceito, pinId, coletadoEm: new Date().toISOString() })
  return b
}

/**
 * Conceitos disponiveis numa faixa: os do Pinterest primeiro, os escritos a
 * mao depois.
 *
 * Os dois convivem de proposito. O banco escrito a mao e a rede de seguranca:
 * se a coleta falhar ou um board secar, a faixa continua tendo o que publicar
 * em vez de derrubar o post do dia.
 */
export function disponiveis(faixa) {
  const b = ler()
  const doPin = b.conceitos
    .filter((c) => c.faixa === faixa)
    .map((c) => ({
      slug: c.slug,
      gancho: c.gancho,
      direcao: c.direcao,
      poses: c.poses,
      selfie: FAIXAS[faixa][0].selfie, // a selfie "antes" e por faixa, nao por conceito
      origem: 'pinterest',
    }))
  return [...doPin, ...FAIXAS[faixa].map((c) => ({ ...c, origem: 'banco' }))]
}
