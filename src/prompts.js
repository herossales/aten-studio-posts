// ============================================================
//  BANCO DE PROMPTS
//  Cada item vira 1 carrossel. O prompt E o produto: ele precisa
//  ser bom o bastante pra alguem querer copiar e colar.
//  v2: alimentar isso por scraping de X/Threads ou por LLM.
// ============================================================

export const banco = [
  {
    slug: 'retrato-janela',
    gancho: 'Luz de janela falsa. Câmera nenhuma. 40 segundos de render.',
    promptBase:
      'Editorial portrait, soft directional window light from camera left, ' +
      'deep falloff into shadow, 85mm lens at f/1.8, subtle film grain, ' +
      'muted earth-tone palette, matte skin texture with visible pores, ' +
      'shallow depth of field, shot on Kodak Portra 400',
    variacoes: [
      'a woman in her 60s with silver hair',
      'a young man with freckles and curly hair',
      'a ballet dancer mid-rest, shoulders exposed',
      'a chef in a dark apron, arms crossed',
    ],
    hashtags: ['iageneration', 'nanobanana', 'fotografia', 'promptdodia', 'aiphotography'],
  },
  {
    slug: 'produto-respingo',
    gancho: 'Esse respingo custou R$ 0 e não molhou nada.',
    promptBase:
      'High-speed product photography, single object suspended mid-air, ' +
      'crown splash of liquid frozen around it, seamless gradient backdrop, ' +
      'hard rim light from behind, glossy reflections, macro detail, ' +
      'commercial advertising style, 100mm macro lens',
    variacoes: [
      'a glass perfume bottle',
      'a matte black wristwatch',
      'a fresh lime cut in half',
      'a ceramic coffee cup',
    ],
    hashtags: ['fotografiadeproduto', 'iageneration', 'nanobanana', 'promptdodia', 'ecommerce'],
  },
  {
    slug: 'pb-alto-contraste',
    gancho: 'Preto e branco que parece scan de negativo. É prompt.',
    promptBase:
      'High contrast black and white portrait, single hard key light, ' +
      'deep crushed blacks, blown highlights on cheekbone, heavy 35mm film grain, ' +
      'dust and scratches, analog imperfection, Ilford HP5 push processed, ' +
      'tight crop on face, direct eye contact',
    variacoes: [
      'an elderly fisherman with a weathered face',
      'a boxer with sweat on the brow',
      'a violinist with eyes closed',
      'a teenager with a shaved head',
    ],
    hashtags: ['pretoebranco', 'iageneration', 'nanobanana', 'promptdodia', 'retrato'],
  },
]

/** Escolhe o conceito do dia de forma deterministica (roda em ciclo). */
export function conceitoDoDia(data = new Date()) {
  const dias = Math.floor(data.getTime() / 86400000)
  return banco[dias % banco.length]
}
