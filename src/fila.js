import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Relativo ao modulo, nao ao cwd: rodar de outra pasta lia uma fila vazia
// e gravava por cima da real.
export const ARQ = fileURLToPath(new URL('../fila.json', import.meta.url))
const vazia = { processados: [], fila: [], publicados: [] }

export const ler = () =>
  existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, 'utf8')) : structuredClone(vazia)

export const gravar = (d) => writeFileSync(ARQ, JSON.stringify(d, null, 2))

/** Ja vimos esse pin? Evita reprocessar e repagar. */
export const jaProcessado = (d, pinId) => d.processados.includes(pinId)

export function enfileirar(d, conceito, pinId) {
  d.processados.push(pinId)
  d.fila.push({ ...conceito, pinId, coletadoEm: new Date().toISOString() })
  return d
}

/**
 * Tira da fila o que ja foi publicado.
 *
 * Cinto e suspensorio: no caminho normal marcarPublicado ja remove. Mas se
 * a execucao anterior publicou e morreu antes de persistir a fila, o mesmo
 * conceito volta pra frente — e ia ao ar de novo. Compara por pinId, que e
 * o unico identificador estavel do que veio do Pinterest.
 * Devolve quantos descartou.
 */
export function descartarJaPublicados(d) {
  const publicados = new Set(d.publicados.map((p) => p.pinId).filter(Boolean))
  if (!publicados.size) return 0
  const antes = d.fila.length
  d.fila = d.fila.filter((c) => !publicados.has(c.pinId))
  return antes - d.fila.length
}

/**
 * Horas desde a ultima publicacao, ou Infinity se nunca publicou.
 *
 * Base da trava anti-duplicata: com mais de um agendador apontando pro mesmo
 * workflow, o segundo disparo precisa saber que o primeiro ja resolveu o dia.
 */
export function horasDesdeUltimoPost(d) {
  const ultimo = d.publicados.at(-1)?.publicadoEm
  if (!ultimo) return Infinity
  const t = Date.parse(ultimo)
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 3_600_000
}

/** Proximo da fila, sem remover — so sai quando publicar der certo. */
export const proximo = (d) => d.fila[0] ?? null

export function marcarPublicado(d, permalink, extra = {}) {
  const c = d.fila.shift()
  d.publicados.push({ ...c, ...extra, permalink, publicadoEm: new Date().toISOString() })
  return d
}

/**
 * Quem ja apareceu nos ultimos posts, pra vetar no proximo elenco.
 *
 * Le do historico e nao de um campo proprio: `publicados` ja e a memoria do
 * que foi ao ar, e uma lista paralela sairia do ar com ela na primeira falha
 * de gravacao.
 */
export function figurasRecentes(d, posts) {
  const nomes = d.publicados
    .slice(-posts)
    .flatMap((p) => p.figuras ?? [])
    .map((f) => String(f).trim())
    .filter(Boolean)
  return [...new Set(nomes)]
}
