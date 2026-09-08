/* Servidor estático mínimo. Existe porque a cena carrega `regua.js` como
   módulo ES, e módulo não carrega por file:// — nem no navegador nem no
   Playwright. Sobe, serve a pasta do projeto, e morre no fim da gravação. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TIPOS = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.woff2':'font/woff2',
};

export function sobeServidor(raiz){
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const arq = path.join(raiz, rel);
      if (!arq.startsWith(raiz)) { res.writeHead(403).end(); return; }
      fs.readFile(arq, (e, buf) => {
        if (e) { res.writeHead(404).end('não encontrado: ' + rel); return; }
        res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    s.listen(0, '127.0.0.1', () => resolve({ porta: s.address().port, fecha: () => s.close() }));
  });
}
