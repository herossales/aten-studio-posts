import sharp from 'sharp'
import { marca } from '../brand.js'

export const L = 1080
export const A = 1920

const escapar = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Camada de texto transparente do tamanho do quadro.
 *
 * Duas linhas, centralizadas: a primeira pesada, a segunda mais leve — e o
 * contraste entre elas que faz o gancho ler em meio segundo de scroll.
 * Sombra atras porque o fundo e video: sem ela o texto some quando a luz da
 * janela estoura atras da cabeca dela.
 */
export async function camadaDeTexto({ linha1, linha2, centroY, corpo = 92 }) {
  const alturaLinha = corpo * 1.12
  // Bloco centrado no centroY: com duas linhas, a primeira sobe meia entrelinha.
  const y1 = centroY - (linha2 ? alturaLinha / 2 : 0) + corpo * 0.34
  const y2 = y1 + alturaLinha

  const linha = (texto, y, peso, estilo, tamanho) => `
    <text x="${L / 2}" y="${y}" text-anchor="middle"
          font-family="${marca.fonte}" font-size="${tamanho}"
          font-weight="${peso}" font-style="${estilo}"
          fill="#FFFFFF" filter="url(#sombra)">${escapar(texto)}</text>`

  const svg = `
    <svg width="${L}" height="${A}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sombra" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000" flood-opacity="0.55"/>
        </filter>
      </defs>
      ${linha(linha1, y1, 800, 'normal', corpo)}
      ${linha2 ? linha(linha2, y2, 400, 'italic', corpo * 0.94) : ''}
    </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}
