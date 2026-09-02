// ============================================================
//  BANCO DE CONCEITOS DOS REELS
//
//  Boards do Pinterest que alimentam as direcoes de arte de cada faixa
//  (ainda nao ligados ao coletor — hoje o banco abaixo e escrito a mao):
//    profissional  https://www.pinterest.com/heros27ar/poses-profissionais-femininas/
//    lifestyle     https://www.pinterest.com/heros27ar/ensaios-life-style-femininas/
//    autoral       https://www.pinterest.com/heros27ar/posts-aten-studio/  (o mesmo dos carrosseis)
// ============================================================

//  Cada conceito vira um Reel: gancho na tela, direcao de arte
//  para as 4 fotos dela, e a selfie "antes" correspondente.
// ============================================================

// A selfie e o "antes" de todo Reel. Varia com a faixa porque uma selfie de
// quarto a noite nao combina com um resultado de terraco ao sol — o salto
// precisa ser grande, mas o contexto tem que fechar.
const SELFIE = {
  dia: 'A casual spontaneous selfie she took herself on a phone front camera — an ordinary ' +
    'everyday snapshot, NOT a professional photo. Arm\'s length, face filling the upper half ' +
    'of the frame, crooked framing, small relaxed smile. Ordinary bedroom by daylight, plain ' +
    'wall, a bit of domestic clutter blurred. Flat front-camera light, soft focus, visible ' +
    'sensor noise, no retouching and no beauty filter, natural skin with pores. Plain black ' +
    'cropped t-shirt.',
  noite: 'A casual spontaneous selfie she took herself on a phone front camera at night — an ' +
    'ordinary snapshot, NOT a professional photo. Arm\'s length, crooked framing, neutral ' +
    'expression. Dim living room lit only by a lamp, plain wall behind. Flat harsh ' +
    'front-camera light, heavy sensor noise in the shadows, soft focus, no retouching, ' +
    'natural skin. Plain black top.',
}

const POSE_SELFIE = 'head and shoulders, arm visible holding the phone'

// Quatro poses por conceito: a primeira e a heroina (aparece em quadrado
// enquanto ela aponta, depois em tela cheia), as tres seguintes fecham.
const c = (slug, l1, l2, direcao, poses, selfie = 'dia') => ({
  slug, gancho: { linha1: l1, linha2: l2 }, direcao, poses,
  selfie: { direcao: SELFIE[selfie], pose: POSE_SELFIE },
})

export const FAIXAS = {
  // MANHA — lugares bonitos, pose solta, luz natural.
  lifestyle: [
    c('santorini', 'Foto com IA', 'em Santorini',
      'Travel lifestyle photograph on a sunlit Mediterranean terrace: whitewashed walls, terracotta pots, bougainvillea, the sea out of focus far behind. Flowing cream linen dress. Late afternoon sun, warm natural light, soft film grain, relaxed candid mood, shallow depth of field, vertical composition.',
      ['three-quarter body leaning on the terrace wall, looking away, hair in the breeze',
       'full body seated on the steps, sandals off, looking down and laughing',
       'chest-up against the whitewashed wall, one hand shading her eyes',
       'three-quarter walking along the terrace, dress catching the wind, looking back']),
    c('cafe-paris', 'Foto com IA', 'num café em Paris',
      'Editorial lifestyle photograph at a Parisian sidewalk café: rattan chairs, marble table, a haussmannian facade blurred behind. She wears a camel trench over a black top. Overcast soft daylight, muted cinematic grade, gentle film grain, candid unposed mood, shallow depth of field, vertical composition.',
      ['seated at the table holding an espresso cup, looking off camera',
       'chest-up resting her chin on her hand, elbow on the marble',
       'standing beside the table buttoning the trench, mid-motion',
       'seated in three-quarter view laughing, hand near her face']),
    c('campo-dourado', 'Foto com IA', 'no fim de tarde',
      'Golden hour lifestyle photograph in an open field of tall dry grass, distant treeline out of focus. She wears a simple white cotton dress. Low warm sun directly behind creating strong rim light and lens haze, soft film grain, dreamy relaxed mood, shallow depth of field, vertical composition.',
      ['chest-up facing the camera with the sun flaring behind her hair',
       'three-quarter walking through the grass, hand brushing the tips',
       'full body seated in the grass, knees up, looking at the horizon',
       'close portrait turned to the light with eyes closed']),
    c('rooftop-noite', 'Foto com IA', 'num rooftop',
      'Night lifestyle photograph on a city rooftop bar: warm string lights overhead, blurred skyline of lit windows far behind. She wears a black slip dress. Mixed warm practical lighting, cinematic teal and amber grade, shallow depth of field, relaxed nocturnal mood, vertical composition.',
      ['chest-up leaning on the rooftop railing, city lights bokeh behind',
       'three-quarter seated on a stool holding a glass, looking at the lens',
       'standing in profile looking out over the city',
       'close portrait lit by the warm string lights, half smile'], 'noite'),
    c('praia-inverno', 'Foto com IA', 'na praia',
      'Lifestyle photograph on a windswept winter beach: pale sand, grey-blue sea, overcast sky. She wears an oversized cream knit sweater. Flat diffused daylight, cool desaturated cinematic grade, visible film grain, contemplative mood, shallow depth of field, vertical composition.',
      ['chest-up with the wind in her hair, hands in the sweater sleeves',
       'full body walking along the waterline, looking down',
       'three-quarter seated on the sand, arms around her knees',
       'close portrait looking straight into the lens, wind across her face']),
  ],

  // MEIO-DIA — profissoes que vendem credibilidade.
  profissional: [
    c('advogada', 'Foto com IA', 'para Advogado',
      'Editorial corporate portrait photograph in a modern law office: floor-to-ceiling windows with soft daylight, blurred bookshelves of legal volumes receding behind. Sharply tailored navy blazer over a white shirt. Cinematic colour grading, shallow depth of field, calm authoritative expression, high detail, vertical composition.',
      ['chest-up standing square to camera, arms relaxed, looking into the lens',
       'seated at a desk in three-quarter view, hands loosely clasped',
       'standing beside the window, arms crossed, turned toward camera',
       'mid-shot walking through the office holding a folder']),
    c('medica', 'Foto com IA', 'para Médico',
      'Editorial corporate portrait photograph in a bright modern clinic: clean white surfaces, soft diffused daylight, blurred medical equipment far behind. She wears a crisp white coat over a light blue top, stethoscope around the neck. Clean clinical colour grading, shallow depth of field, warm reassuring expression, high detail, vertical composition.',
      ['chest-up standing square to camera, hands in the coat pockets',
       'three-quarter seated at a consulting desk, leaning slightly forward',
       'standing in a corridor, arms relaxed, looking into the lens',
       'mid-shot beside a window holding a tablet']),
    c('empresaria', 'Foto com IA', 'para Empresário',
      'Editorial executive portrait photograph in a modern corporate office: glass partitions, city skyline blurred through the window, minimal architecture. She wears a charcoal tailored suit over a black top. Cool cinematic colour grading, controlled directional light, shallow depth of field, composed confident expression, high detail, vertical composition.',
      ['chest-up standing square to camera, arms crossed',
       'seated on the edge of a desk in three-quarter view',
       'standing at the glass wall, city behind, looking into the lens',
       'mid-shot walking through the office, jacket open']),
    c('fisioterapeuta', 'Foto com IA', 'para Fisioterapeuta',
      'Editorial professional portrait photograph in a bright modern physiotherapy studio: light wood floor, exercise equipment softly blurred behind, large windows. She wears a fitted navy polo and light trousers. Warm natural daylight, clean colour grading, shallow depth of field, approachable confident expression, high detail, vertical composition.',
      ['chest-up standing square to camera, arms relaxed',
       'three-quarter leaning against a treatment table, arms crossed',
       'standing beside the window, hands on hips, looking into the lens',
       'mid-shot walking through the studio, smiling slightly']),
    c('arquiteta', 'Foto com IA', 'para Arquiteto',
      'Editorial professional portrait photograph in a minimal architecture studio: concrete and pale wood, scale models softly blurred behind, large industrial windows. She wears a black turtleneck. Neutral cinematic colour grading, soft directional daylight, shallow depth of field, thoughtful composed expression, high detail, vertical composition.',
      ['chest-up standing square to camera, arms relaxed',
       'three-quarter leaning over a drafting table',
       'standing beside a scale model, arms crossed, looking into the lens',
       'mid-shot at the window with rolled drawings under her arm']),
  ],

  // NOITE — retrato autoral, luz dura, sem cenario.
  autoral: [
    c('preto-e-branco', 'Foto com IA', 'em preto e branco',
      'Fine-art black and white studio portrait. Single hard key light from the side sculpting the face, deep falloff into a pure black background, no props, no colour at all. Simple black top. High contrast monochrome, rich blacks, luminous highlights on the skin, visible film grain, editorial fashion mood, vertical composition.',
      ['tight chest-up square to camera, chin slightly lifted, direct eye contact',
       'profile turned away, only the rim of the face lit',
       'head and shoulders, hand touching her jaw, eyes closed',
       'chest-up three-quarter, looking over the shoulder into the lens'], 'noite'),
    c('neon', 'Foto com IA', 'com luz neon',
      'Editorial studio portrait lit only by coloured neon: deep magenta key from one side, cyan rim from the other, pure black background, no props. Simple black top. Saturated cinematic grade, hard shadows, glossy highlights on the skin, slight halation around the lights, vertical composition.',
      ['tight chest-up square to camera, direct eye contact',
       'three-quarter turned into the magenta side, eyes down',
       'profile against the cyan rim light',
       'head and shoulders looking up past the camera'], 'noite'),
    c('sombra-veneziana', 'Foto com IA', 'com sombras de luz',
      'Editorial studio portrait with hard window-blind shadows striping across the face and body, single hard key light, dark neutral background, no props. Simple black top. Warm desaturated cinematic grade, deep contrast, visible film grain, mysterious mood, vertical composition.',
      ['tight chest-up square to camera, stripes across the eyes',
       'three-quarter with the stripes falling diagonally',
       'profile with a single band of light across the face',
       'head and shoulders looking down, shadows across the shoulders'], 'noite'),
    c('rembrandt', 'Foto com IA', 'com luz de estúdio',
      'Classical studio portrait with Rembrandt lighting: soft key at 45 degrees creating the small triangle of light on the shadowed cheek, dark charcoal seamless background, no props. Simple black top. Warm painterly colour grading, gentle falloff, fine detail in the skin, timeless editorial mood, vertical composition.',
      ['tight chest-up square to camera, calm direct gaze',
       'three-quarter turned into the shadow side',
       'head and shoulders with the chin slightly lowered',
       'chest-up looking off camera to the light'], 'noite'),
    c('duplo-exposicao', 'Foto com IA', 'em dupla exposição',
      'Fine-art double exposure portrait: her profile blended with the silhouette of a dense forest canopy, dark background, monochrome with a faint warm tone. High contrast, grainy analogue texture, artistic editorial mood, vertical composition.',
      ['profile facing right, canopy filling the head and shoulders',
       'front-facing chest-up, branches across the face',
       'three-quarter with the trees emerging from the shoulder',
       'head and shoulders, eyes closed, canopy dense over the hair'], 'noite'),
  ],
}

/** Faixa correspondente a hora, em UTC (BRT = UTC-3). */
export function faixaDaHora(horaUtc = new Date().getUTCHours()) {
  if (horaUtc < 12) return 'lifestyle'      // manha no Brasil
  if (horaUtc < 18) return 'profissional'   // meio do dia
  return 'autoral'                          // noite
}
