/* Carrega .env sem dependência nenhuma. Se o arquivo não existir, não reclama:
   no runner do GitHub Actions as variáveis chegam por secrets, não por arquivo. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const arq = path.join(RAIZ, '.env');
if (fs.existsSync(arq)) {
  for (const linha of fs.readFileSync(arq, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

export const env = (nome, padrao = null) => process.env[nome] ?? padrao;
