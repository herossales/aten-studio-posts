import { existsSync, readFileSync } from 'node:fs'

// Carrega .env sem dependencia externa. No GitHub Actions o .env nao
// existe — as variaveis ja vem do ambiente (secrets + automaticas).
const envLocal = new URL('../.env', import.meta.url)
if (existsSync(envLocal)) {
  for (const linha of readFileSync(envLocal, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

export const cfg = {
  igUserId: process.env.IG_USER_ID,
  metaToken: process.env.META_ACCESS_TOKEN,
  geminiKey: process.env.GEMINI_API_KEY,

  // No Actions, GITHUB_TOKEN e GITHUB_REPOSITORY vem de graca.
  ghToken: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
  ghRepo: process.env.GH_REPO || process.env.GITHUB_REPOSITORY,
  ghBranch: process.env.GH_BRANCH || 'main',

  apifyToken: process.env.APIFY_TOKEN,
  apifyActor: process.env.APIFY_ACTOR || 'automation-lab~pinterest-scraper',
  boards: process.env.PINTEREST_BOARDS,

  api: 'https://graph.facebook.com/v21.0',
}

export function exigir(...chaves) {
  const faltando = chaves.filter((k) => !cfg[k])
  if (faltando.length) throw new Error(`Faltam no .env: ${faltando.join(', ')}`)
}
