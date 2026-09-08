/* Sobe a trilha para um Release, de onde o runner do Actions a baixa.
   Fora do git de propósito: o repositório é público.
     node src/trilha.js            sobe ./Trilha.mp3
     node src/trilha.js caminho    sobe outro arquivo com o mesmo nome */
import fs from 'node:fs';
import path from 'node:path';
import { env, RAIZ } from './config.js';

const TAG = 'buraco-negro-assets';
const arquivo = path.resolve(process.argv[2] || path.join(RAIZ, 'Trilha.mp3'));
if (!fs.existsSync(arquivo)) { console.error(`não achei ${arquivo}`); process.exit(1); }

const repo = env('GH_REPO');
const gh = (u, o = {}) => fetch(u.startsWith('http') ? u : 'https://api.github.com' + u, {
  ...o, headers: { Authorization: `token ${env('GH_TOKEN')}`, Accept: 'application/vnd.github+json',
                   'User-Agent': 'buraco-negro', ...o.headers } });

let r = await gh(`/repos/${repo}/releases/tags/${TAG}`);
let rel = r.ok ? await r.json() : null;
if (!rel) {
  r = await gh(`/repos/${repo}/releases`, { method: 'POST', body: JSON.stringify({
    tag_name: TAG, name: 'Buraco Negro — assets', prerelease: true,
    body: 'Arquivos fixos que o runner baixa a cada rodada. Fora do git porque o repositório é público.' }) });
  if (!r.ok) { console.error(`release: ${r.status} ${await r.text()}`); process.exit(1); }
  rel = await r.json();
}

const nome = 'Trilha.mp3';
for (const a of rel.assets ?? []) {
  if (a.name === nome) await gh(`/repos/${repo}/releases/assets/${a.id}`, { method: 'DELETE' });
}
r = await gh(`${rel.upload_url.split('{')[0]}?name=${nome}`,
  { method: 'POST', headers: { 'Content-Type': 'audio/mpeg' }, body: fs.readFileSync(arquivo) });
if (!r.ok) { console.error(`upload: ${r.status} ${await r.text()}`); process.exit(1); }
const { browser_download_url } = await r.json();
console.log(`trilha no ar: ${browser_download_url}`);
