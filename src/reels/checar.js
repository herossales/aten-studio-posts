// Diagnostico barato: exercita o ffmpeg com as bases reais, sem gerar imagem.
// Roda antes da geracao no workflow pra falhar em segundos em vez de falhar
// depois de cinco chamadas pagas ao Nano Banana.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { camadaDeTexto } from './texto.js'
import { montarReel } from './montar.js'

const BASES = process.env.BASES_DIR || 'Referencia Reels/Bases Reels'
console.log('BASES_DIR =', BASES)
console.log('FFMPEG_BIN =', process.env.FFMPEG_BIN || '(padrao: ffmpeg do PATH)')

const png = await camadaDeTexto({ linha1: 'teste', linha2: 'de camada', centroY: 1120 })
console.log('sharp/SVG ok:', (png.length / 1024).toFixed(0) + 'KB')

const dir = mkdtempSync(join(tmpdir(), 'checar-'))
const { execFileSync } = await import('node:child_process')
const bin = process.env.FFMPEG_BIN || 'ffmpeg'
try {
  execFileSync(bin, ['-y', '-v', 'error', '-i', `${BASES}/01 - Influencer - Gancho.mp4`,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-t', '0.3', '-pix_fmt', 'yuv420p',
    join(dir, 'x.mp4')], { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 32e6 })
  console.log('ffmpeg ok: leu a base e escreveu um trecho')
} catch (e) {
  console.error('ffmpeg FALHOU:', e.code || '', e.signal || '', e.status ?? '')
  console.error(e.stderr?.toString().slice(0, 800) || '(stderr vazio)')
  process.exit(1)
}
