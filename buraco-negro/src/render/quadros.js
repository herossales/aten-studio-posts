/* Tira fotos de instantes específicos, para conferir enquadramento sem gravar
   o vídeo inteiro:  node src/render/quadros.js 0 2.4 3.6 19 24 */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sobeServidor } from './servidor.js';
import { roteiro, gerar } from '../narracao.js';
import { env } from '../config.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempos = process.argv.slice(2).filter(a => !isNaN(+a)).map(Number);
const i = process.argv.indexOf('--dados');
const dados = i >= 0 ? JSON.parse(fs.readFileSync(process.argv[i+1],'utf8')) : null;

const srv = await sobeServidor(RAIZ);
const nav = await chromium.launch({ headless: true, channel: 'chrome',
  args:['--enable-unsafe-swiftshader','--hide-scrollbars','--force-color-profile=srgb'] });
const pag = await nav.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
pag.on('pageerror', e => console.error('erro:', e.message));
/* Mesma legenda do vídeo final, para a foto de conferência não mentir. */
const ATRASO_VOZ = 0.8;
let legendas = null;
if (env('ELEVEN_API_KEY')) {
  const est = dados
    ? { dia: dados.dia ?? 1, antes: dados.antes ?? 0, depois: (dados.antes ?? 0) + (dados.novos?.length ?? 0) }
    : { dia: 1, antes: 0, depois: 148 };
  const r = await gerar(roteiro(est));
  legendas = (r.legendas || []).map(b => ({
    t0: b.t0 + ATRASO_VOZ, t1: b.t1 + ATRASO_VOZ,
    palavras: b.palavras.map(w => ({ p: w.p, t0: w.t0 + ATRASO_VOZ, t1: w.t1 + ATRASO_VOZ })),
  }));
}
await pag.addInitScript(d => {
  window.__GRAVANDO = true;
  if (d.dados) window.__DADOS = d.dados;
  if (d.legendas) window.__LEGENDAS = d.legendas;
}, { dados, legendas });
await pag.goto(`http://127.0.0.1:${srv.porta}/src/cena/cena.html`);
await pag.evaluate(() => window.__cena.pronta);

fs.mkdirSync(path.join(RAIZ,'out','quadros'), { recursive:true });
for (const t of tempos){
  await pag.evaluate(x => window.__cena.seek(x), t);
  const f = path.join(RAIZ,'out','quadros', `t${String(t).replace('.','_')}.png`);
  await pag.locator('#quadro').screenshot({ path: f });
  console.log(f);
}
await nav.close(); srv.fecha();
