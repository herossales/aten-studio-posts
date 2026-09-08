/* Tudo o que é texto fixo da série mora aqui. Muda num lugar só. */
export const marca = {
  conta: 'singlr.project',
  titulo: 'Criando um Buraco Negro<br>com Futuros Milionários',
  cta: [
    'Você será o primeiro',
    'milionário de sua família.',
    'Comente <span class="chave">EU CREIO</span> para se juntar a nós.',
  ],
  /* Quantas pessoas novas justificam um vídeo. Com 0, a rodada não publica
     nada e o dia não é consumido — "Dia N" é o N-ésimo VÍDEO, não o N-ésimo
     dia do calendário, então a numeração continua colada.
     Publicar um vídeo idêntico ao de ontem dizendo que ninguém entrou não
     parece constância, parece série morta — e ainda divide o alcance entre
     dois posts. Os comentários seguem chegando no post que já está no ar, e a
     coleta lê as últimas 12 publicações: ninguém se perde esperando. */
  minimoParaPublicar: 1,

  /* A trilha. `apice` é o segundo em que ela chega no êxtase; o gravador
     recua o início para que esse instante caia exatamente no clímax do vídeo
     — o nascimento do buraco negro. `padrao` é onde ela começa nos vídeos que
     não têm clímax marcado. */
  trilha: { apice: 130, padrao: 23 },

  /* Colaboradores fixos da série. Até 3 — o limite é da API, e só vale em
     Reels e imagem única (carrossel recusa). É CONVITE: o post só aparece no
     perfil de cada um depois que ele aceitar, e a conta precisa ser pública.
     Enquanto não aceitam, o Reel sai normal só aqui.
     Desligado por ora. Para religar, basta pôr os @ de volta na lista — a
     publicação já tolera quem recusar o convite. */
  colaboradores: [],

  /* Nomeia a trilha embutida. É o que faz todos os Reels da série caírem na
     mesma página de áudio da conta — a API não deixa escolher som do
     Instagram em nenhum formato. */
  audioName: 'A Singularidade',
  /* Reel no feed além da aba de Reels. No projeto irmão levantou-se a hipótese
     de isto jogar o Reel no ranking de feed e cortar alcance; nunca foi
     confirmado. Fica aqui para ser testado UMA variável de cada vez. */
  reelNoFeed: false,
  /* A imagem é uma simulação física renderizada e fotos reais de perfil — não
     há pessoa gerada por IA. A locução, porém, é voz sintética. Declarar custa
     pouco; não declarar, se a Meta entender que se aplica, custa alcance de
     forma permanente naquele post. Na dúvida, declara. */
  declararIA: true,
};
