/* ============================================================================
   A RÉGUA
   Converte "quantas pessoas comentaram" em massa, estágio e tamanho na tela.
   Roda no navegador (via <script src>) e no Node (via import).

   Fase estrela   0 → 600.000 pessoas   massa linear: 25.000 pessoas = 1 M☉
   Fase buraco    600.000 → 1.000.000   massa exponencial: 3 M☉ → 6,6e10 M☉

   A quebra em 600.000 é a supernova: 24,1 M☉ de estrela viram 3 M☉ de buraco
   negro. Não é bug, é o que acontece de verdade — o resto é expelido.
============================================================================ */

const COLAPSO   = 600000;    // pessoas que derrubam a estrela
const META      = 1000000;   // pessoas que fazem dele o maior conhecido
const POR_SOL   = 25000;     // pessoas por massa solar, fase estelar
const M_INICIAL = 0.1;       // M☉ da anã vermelha com 0 pessoas
const M_BN      = 3;         // M☉ do buraco negro recém-nascido
const M_META    = 6.6e10;    // M☉ do TON 618

// quanto cada pessoa multiplica a massa depois do colapso
const EXPO = Math.log10(M_META / M_BN) / (META - COLAPSO);

/* Estágios da estrela, por número de participantes.
   raio/temp/gran alimentam o shader; a interpolação entre dois estágios é suave,
   então o visual muda continuamente e não em degraus. */
const ESTAGIOS = [
  { de: 0,      nome: 'anã vermelha',          raio: 0.85, temp: 3200,  gran: 1.00,
    desc: 'Uma anã vermelha. Pequena, fria, quase invisível.' },
  { de: 10000,  nome: 'anã laranja',           raio: 1.15, temp: 4500,  gran: 0.90,
    desc: 'Anã laranja. Mais quente, mais brilhante. Já dá para ver de longe.' },
  { de: 25000,  nome: 'estrela amarela',       raio: 1.45, temp: 5800,  gran: 0.80,
    desc: 'Amarela, como o Sol. Estável, no meio da vida.' },
  { de: 75000,  nome: 'estrela branca',        raio: 1.80, temp: 8500,  gran: 0.55,
    desc: 'Branca. Queima rápido o combustível que tem.' },
  { de: 150000, nome: 'azul-branca',           raio: 2.30, temp: 13000, gran: 0.40,
    desc: 'Azul-branca. Centenas de vezes mais luminosa que o Sol.' },
  { de: 300000, nome: 'gigante azul',          raio: 3.00, temp: 24000, gran: 0.30,
    desc: 'Gigante azul. Quanto mais massa, menos tempo de vida.' },
  { de: 500000, nome: 'supergigante vermelha', raio: 5.40, temp: 3600,  gran: 1.20,
    desc: 'Supergigante. Inchou e esfriou. É o último estágio antes do fim.' },
];

/* Marcos anunciáveis da série inteira. `nota` é o que se diz no vídeo. */
/* `nota` é o rótulo curto do HUD. `fala` completa "Faltam X pessoas para ela…"
   e vem escrito como se lê em voz alta, porque quem lê é um TTS: "M87*" sai
   errado, "M oitenta e sete" sai certo. */
const MARCOS = [
  { n: 10000,   nota: 'anã laranja',          fala: 'virar uma anã laranja' },
  { n: 22500,   nota: 'a massa do Sol',       fala: 'ter a massa exata do Sol' },
  { n: 25000,   nota: 'estrela amarela',      fala: 'virar uma estrela amarela' },
  { n: 75000,   nota: 'estrela branca',       fala: 'virar uma estrela branca' },
  { n: 150000,  nota: 'azul-branca',          fala: 'virar uma azul-branca' },
  { n: 300000,  nota: 'gigante azul',         fala: 'virar uma gigante azul' },
  { n: 500000,  nota: 'a supergigante',       fala: 'virar uma supergigante vermelha' },
  { n: 600000,  nota: 'a supernova',          fala: 'não aguentar mais e explodir' },
  { n: 632700,  nota: 'Cygnus X-1',           fala: 'alcançar o Cygnus X um' },
  { n: 697600,  nota: 'massa intermediária',  fala: 'virar um buraco negro de massa intermediária' },
  { n: 838100,  nota: 'Sagitário A*',         fala: 'alcançar Sagitário A estrela, o buraco negro da nossa galáxia' },
  { n: 961100,  nota: 'M87*',                 fala: 'alcançar M oitenta e sete, o da primeira foto da história' },
  { n: 1000000, nota: 'TON 618',              fala: 'alcançar o Tón seiscentos e dezoito, o maior que a humanidade já mediu' },
];

const clamp  = (x, a, b) => Math.min(b, Math.max(a, x));
const suave  = t => t * t * (3 - 2 * t);

const fase = n => (n < COLAPSO ? 'estrela' : 'buraco');

/* Massa em massas solares. Contínua dentro de cada fase, com o salto da
   supernova entre elas. */
function massa(n) {
  n = Math.max(0, n);
  if (n < COLAPSO) return M_INICIAL + n / POR_SOL;
  return M_BN * Math.pow(10, EXPO * (n - COLAPSO));
}

/* Raio do horizonte de eventos, em km. Só existe depois do colapso. */
const raioHorizonteKm = n => 2.95 * massa(n);

/* Parâmetros visuais da estrela: interpola entre os dois estágios vizinhos. */
function estrela(n) {
  n = clamp(n, 0, COLAPSO);
  let i = 0;
  while (i < ESTAGIOS.length - 1 && n >= ESTAGIOS[i + 1].de) i++;
  const cur = ESTAGIOS[i];
  const nxt = ESTAGIOS[i + 1] || null;
  const fim = nxt ? nxt.de : COLAPSO;
  const f = clamp((n - cur.de) / (fim - cur.de), 0, 1);
  const t = suave(f);
  const alvo = nxt || cur;
  // no último estágio ela incha rumo ao colapso em vez de virar outra coisa
  const incha = nxt ? 1 : 1 + 0.25 * f;
  return {
    indice: i,
    fracao: f,
    estagio: cur,
    ultimo: !nxt,
    raio: (cur.raio * (1 - t) + alvo.raio * t) * incha,
    temp: cur.temp * (1 - t) + alvo.temp * t,
    gran: cur.gran * (1 - t) + alvo.gran * t,
  };
}

/* Raio do buraco negro em unidades de cena. Cresce em log para caber no quadro:
   de 1,0 no nascimento a 4,0 quando ele for o TON 618. */
function raioCena(n) {
  const decadas = Math.log10(massa(n) / M_BN);
  const total = Math.log10(M_META / M_BN);
  return 1.0 + 3.0 * clamp(decadas / total, 0, 1);
}

/* Percorre a escada de estágios em tempo igual para cada um.
   Uma rampa linear em `n` não serve para isso: a anã laranja fica a 1,7% do
   caminho até o colapso e a gigante azul a 50%, então os primeiros estágios
   passariam num piscar e os últimos ocupariam o vídeo inteiro. */
function nDaFracao(f) {
  f = clamp(f, 0, 1);
  const marcos = ESTAGIOS.map(e => e.de).concat(COLAPSO);
  const passo = f * (marcos.length - 1);
  const i = Math.min(marcos.length - 2, Math.floor(passo));
  const dentro = passo - i;
  return marcos[i] + (marcos[i + 1] - marcos[i]) * dentro;
}

/* Próximo marco a bater, para o HUD e para a legenda do post. */
function proximoMarco(n) {
  return MARCOS.find(m => m.n > n) || null;
}

/* Frase de estado, a que aparece embaixo do contador. */
function frase(n) {
  if (n < COLAPSO) {
    const e = estrela(n);
    const restam = COLAPSO - n;
    if (e.ultimo) return `${cap(e.estagio.nome)}. Faltam ${fmt(restam)} pessoas para ela não aguentar mais.`;
    return `${cap(e.estagio.nome)}. ${e.estagio.desc.replace(/^[^.]*\.\s*/, '')}`;
  }
  return `Buraco negro. Nasceu com 3 sóis e cresce a cada pessoa que entra.`;
}

const cap = s => s[0].toUpperCase() + s.slice(1);
const fmt = n => Math.round(n).toLocaleString('pt-BR');

/* Massa formatada: sóis até 10 mil, notação científica acima. */
function fmtMassa(m) {
  if (m < 10000) return m.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' sóis';
  const e = Math.floor(Math.log10(m));
  const mant = m / Math.pow(10, e);
  return mant.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '×10' + sup(e) + ' sóis';
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = e => String(e).split('').map(c => SUP[+c] ?? c).join('');

function fmtKm(km) {
  if (km < 1e6) return km.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km';
  const ua = km / 149597870.7;
  if (ua < 1000) return ua.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' UA';
  return (km / 9.461e12).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' anos-luz';
}

/* ---------------------------------------------------------------------------
   Números por extenso. A narração é lida por TTS, e "1.971" vira loteria:
   pode sair "um ponto novecentos e setenta e um". Escrito por extenso, não.
--------------------------------------------------------------------------- */
const UNI = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez',
             'onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const DEZ = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const CEM = ['','cento','duzentos','trezentos','quatrocentos','quinhentos',
             'seiscentos','setecentos','oitocentos','novecentos'];

/* "massas da Terra" é feminino: 1.971 se lê "mil novecentas e setenta e UMA".
   Só um, dois e as centenas mudam de forma — e nunca antes de milhão/bilhão,
   que são substantivos masculinos: "um milhão de pessoas", jamais "uma
   milhão", mesmo contando coisa feminina. */
const feminino = t => t
  .replace(/\bum\b(?! (?:milhão|milhões|bilhão|bilhões))/g, 'uma')
  .replace(/\bdois\b(?! (?:milhão|milhões|bilhão|bilhões))/g, 'duas')
  .replace(/entos\b/g, 'entas');

function ate999(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  if (n < 20) return UNI[n];
  if (n < 100) { const d = (n/10)|0, u = n%10; return DEZ[d] + (u ? ' e ' + UNI[u] : ''); }
  const c = (n/100)|0, r = n%100;
  return CEM[c] + (r ? ' e ' + ate999(r) : '');
}

function porExtenso(n, fem = false) {
  n = Math.round(n);
  if (n === 0) return 'zero';
  if (n < 0) return 'menos ' + porExtenso(-n, fem);
  const partes = [];
  const bi = (n / 1e9) | 0, mi = ((n % 1e9) / 1e6) | 0, mil = ((n % 1e6) / 1000) | 0, r = n % 1000;
  if (bi)  partes.push(bi  === 1 ? 'um bilhão'  : ate999(bi)  + ' bilhões');
  if (mi)  partes.push(mi  === 1 ? 'um milhão'  : ate999(mi)  + ' milhões');
  if (mil) partes.push(mil === 1 ? 'mil'        : ate999(mil) + ' mil');
  if (r)   partes.push(ate999(r));

  let saida;
  if (partes.length === 1) saida = partes[0];
  else {
    /* Em português o "e" só entra antes do resto quando ele é menor que cem
       ou é centena redonda: "mil e cinquenta", mas "mil novecentos e um". */
    const ultimo = partes.pop();
    const lig = (r > 0 && (r < 100 || r % 100 === 0)) ? ' e ' : ' ';
    saida = partes.join(' ') + lig + ultimo;
  }
  return fem ? feminino(saida) : saida;
}

/* ---------------------------------------------------------------------------
   Ganho do dia. Na fase estelar o acréscimo em massas solares é minúsculo
   (148 pessoas = 0,006 sol) e soa a nada. Em massas da Terra o mesmo fato
   vira "mil novecentas e setenta e uma" — verdadeiro e audível.
--------------------------------------------------------------------------- */
const TERRAS_POR_SOL = 332946;

function ganhoDoDia(antes, depois) {
  /* No dia do colapso não existe "ganho": a estrela explode e joga fora quase
     tudo o que juntou. 24 massas solares viram 3. Quem chama trata à parte. */
  if (fase(antes) !== fase(depois)) return { colapsou: true, escrito: null, falado: null };
  const d = massa(depois) - massa(antes);
  if (d >= 1) return { escrito: fmtMassa(d), falado: fmtMassaFalado(d) };
  const terras = Math.round(d * TERRAS_POR_SOL);
  return {
    escrito: fmt(terras) + (terras === 1 ? ' massa da Terra' : ' massas da Terra'),
    falado: porExtenso(terras, true) + (terras === 1 ? ' massa da Terra' : ' massas da Terra'),
  };
}

/* Massa falada: acima de mil sóis a notação científica não se lê em voz alta,
   então vira "seis vírgula seis bilhões de vezes a massa do Sol". */
function fmtMassaFalado(m) {
  /* "sóis" e não "vezes a massa do Sol": é a mesma coisa, cabe na metade do
     tempo, e é a palavra que já está escrita no HUD. */
  if (m < 1000) {
    /* Uma casa decimal, não duas: com duas, 3,07 saía como "três vírgula
       sete", porque o zero à esquerda desaparecia na leitura. */
    const q = Math.round(m * 10) / 10;
    const i = Math.floor(q), dec = Math.round((q - i) * 10);
    return porExtenso(i) + (dec ? ' vírgula ' + porExtenso(dec) : '') + (q === 1 ? ' sol' : ' sóis');
  }
  const [nome, escala] = m >= 1e9 ? ['bilhões', 1e9] : m >= 1e6 ? ['milhões', 1e6] : ['mil', 1e3];
  const q = Math.round(m / escala * 10) / 10;
  const i = Math.floor(q), dec = Math.round((q - i) * 10);
  const num = porExtenso(i) + (dec ? ' vírgula ' + porExtenso(dec) : '');
  return nome === 'mil' ? `${num} mil sóis` : `${num} ${nome} de sóis`;
}

const REGUA = {
  COLAPSO, META, POR_SOL, M_INICIAL, M_BN, M_META, EXPO, ESTAGIOS, MARCOS,
  fase, massa, raioHorizonteKm, estrela, raioCena, proximoMarco, frase,
  fmt, fmtMassa, fmtKm, porExtenso, ganhoDoDia, fmtMassaFalado, TERRAS_POR_SOL,
  nDaFracao,
};

export default REGUA;
