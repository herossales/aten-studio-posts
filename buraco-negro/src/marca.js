/* Tudo o que é texto fixo da série mora aqui. Muda num lugar só. */
export const marca = {
  conta: 'singlr.project',
  titulo: 'Criando um Buraco Negro<br>com Futuros Milionários',
  cta: [
    'Você será o primeiro',
    'milionário de sua família.',
    'Comente <span class="chave">EU CREIO</span> para se juntar a nós.',
  ],
  /* A trilha. `apice` é o segundo em que ela chega no êxtase; o gravador
     recua o início para que esse instante caia exatamente no clímax do vídeo
     — o nascimento do buraco negro. `padrao` é onde ela começa nos vídeos que
     não têm clímax marcado. */
  trilha: { apice: 130, padrao: 23 },

  /* Colaboradores fixos da série. Até 3 — o limite é da API, e só vale em
     Reels e imagem única (carrossel recusa). É CONVITE: o post só aparece no
     perfil de cada um depois que ele aceitar, e a conta precisa ser pública.
     Enquanto não aceitam, o Reel sai normal só aqui. */
  colaboradores: ['heros_sales', 'millersantt', 'atilagomess'],

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
