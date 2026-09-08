/* Abre a cena no navegador padrão, rodando em tempo real. */
import { sobeServidor } from './servidor.js';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srv = await sobeServidor(RAIZ);
const url = `http://127.0.0.1:${srv.porta}/src/cena/cena.html`;
console.log('cena em ' + url + '   (ctrl+c para encerrar)');
execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
