/* ============================================================================
   ESTADO
   Quem já entrou, e o que já foi publicado. É este arquivo que faz a estrela
   ser cumulativa: sem ele, cada vídeo regeraria as mesmas pessoas e ninguém
   nunca "ficaria" lá dentro.
============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './config.js';

export const ARQUIVO = path.join(RAIZ, 'estado.json');

const VAZIO = { dia: 0, participantes: [], publicados: [] };

export function carregar() {
  if (!fs.existsSync(ARQUIVO)) return structuredClone(VAZIO);
  const e = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
  return { ...structuredClone(VAZIO), ...e };
}

export function salvar(estado) {
  /* Escreve num temporário e renomeia: se o processo morrer no meio da
     escrita, o estado antigo continua íntegro em vez de virar JSON pela
     metade — e um estado corrompido apaga a série inteira. */
  const tmp = ARQUIVO + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2) + '\n');
  fs.renameSync(tmp, ARQUIVO);
}

export const total = estado => estado.participantes.length;

/** Quem já está dentro, por @ em minúsculas. Uma pessoa entra uma vez só. */
export const jaDentro = estado => new Set(estado.participantes.map(p => p.username.toLowerCase()));
