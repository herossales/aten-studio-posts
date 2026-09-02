// ============================================================
//  IDENTIDADE DO @atenstudio.ai
//  Ajuste aqui: e o unico arquivo que muda o "tom" dos posts.
// ============================================================

export const marca = {
  arroba: '@atenstudio.ai',

  palavraChave: 'PROMPT', // o que a pessoa comenta pra receber no direct

  // Artes aplicadas nas laminas de ponta, relativas a raiz do projeto.
  // Trazem o letreiro, a copy e o arroba prontos dentro do PNG — trocar
  // de serie e trocar estes arquivos, sem mexer em codigo.
  rodape: 'Rodapé - Prompts.png', // abre o carrossel (lamina 1)
  cta: 'Final-CTA.png',   // fecha o carrossel (ultima lamina)

  // Etiqueta que classifica o prompt, impressa sob o letreiro da lamina 1.
  fonte: 'Helvetica Neue, Helvetica, Arial, sans-serif',
  corTexto: '#FFFFFF',

  // Encadeia as laminas 2..N na lamina 1, trocando so a pessoa. Da a maior
  // consistencia possivel, mas parte do resultado passa a vir de um anexo que
  // quem compra o prompt nao recebe.
  encadearNaPrimeira: true,

  // Rede de seguranca de cor: depois de gerar, puxa as laminas pra mediana
  // de cada canal. O prompt ja carrega o balanco em Kelvin e resolve a maior
  // parte; isto fecha o residuo de variancia do modelo. Desligue pra ver a
  // saida crua do prompt.
  nivelarGrade: true,

  // Ligar faz a foto original do pin ir junto com o prompt como referencia
  // visual. Melhora cor e composicao, mas parte do resultado passa a vir de
  // um anexo que quem compra o prompt nao recebe. Desligue pra validar se o
  // prompt sozinho se sustenta.
  usarReferenciaDoPin: true,

  // Janela minima entre publicacoes, em horas. Existe pra que mais de um
  // agendador possa apontar pro mesmo workflow sem risco de post duplicado:
  // o primeiro publica, o segundo bate na trava e sai sem gastar geracao.
  // Como os slots mais proximos sao 06:32 e 11:17 (4h45), 3h da folga
  // suficiente sem nunca barrar um post legitimo.
  horasEntrePosts: 3,

  // Quantos posts para tras entram na lista de veto do elenco. A 3 posts/dia,
  // 8 cobre os ultimos dois dias e meio — o suficiente pra ninguem se repetir
  // dentro da mesma rolagem de feed. Subir demais estrangula: sao 5 nomes por
  // post, e a barra de fama alta ja deixa o conjunto de candidatos pequeno.
  postsSemRepetirElenco: 8,

  // Categorias que o diretor de elenco nao pode escalar. Politica sai por
  // padrao: em ano eleitoral, imagem fotorrealista de candidato real cai na
  // regra do TSE sobre conteudo sintetico, e uma lamina printada fora do
  // carrossel vira peca de desinformacao sem querer. Esvazie a lista se
  // quiser liberar.
  categoriasBloqueadas: ['politica', 'eleicao', 'religiao'],

  // Reel tambem no grid do perfil? Desligado: o feed e dos carrosseis, que
  // sao o formato salvavel. Reel no grid empurra o carrossel pra baixo e
  // mistura duas linguagens na mesma vitrine.
  reelNoFeed: false,

  // Nome da faixa embutida nos Reels. A API nao deixa escolher som do
  // Instagram em nenhum formato, entao a trilha vai dentro do arquivo — e este
  // nome faz todos os Reels caírem na mesma pagina de audio, que e da conta.
  nomeDoAudio: 'Aten | Roube meu prompt',

  // Conceito vindo do Pinterest nao traz hashtag propria. Sem isso a
  // legenda sai sem nenhuma e o alcance morre.
  hashtagsPadrao: ['iageneration', 'nanobanana', 'promptdodia', 'aiphotography', 'direcaodearte'],
}

// CTA fixo: a palavra "Prompt" aqui tem que bater com o que a arte do
// Final-CTA.png mostra e com o que o robo de DM escuta nos comentarios.
const CTA = 'Comenta Prompt que te mando o guia completo na DM.'

/** Monta a legenda final do post: texto do estagiario + CTA fixo + hashtags. */
export function montarLegenda({ texto, hashtags = [] }) {
  return [texto, '', '— — —', '', CTA, '', hashtags.map((h) => `#${h}`).join(' ')].join('\n')
}
