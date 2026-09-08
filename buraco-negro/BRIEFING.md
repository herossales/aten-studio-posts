# Buraco Negro — briefing do projeto

> Documento de partida. Escrito em 04/09/2026, a partir do que já foi testado e
> medido no projeto irmão `AtenStuduioPosts` (o pipeline do `@atenstudio.ai`).
> Tudo que está marcado como **verificado** foi rodado contra a API de verdade,
> não tirado de documentação.

---

## 1. A ideia

Uma série de Reels em que os seguidores são "jogados dentro de uma estrela" —
a foto de perfil e o `@` de cada participante orbitam e caem numa estrela, que
cresce a cada vídeo. Quando ela acumular massa suficiente, colapsa e **nasce o
buraco negro**. A meta pública amarrada ao evento é **1 milhão de seguidores**.

Cada vídeo mostra a estrela maior que no anterior. É série acumulativa, não
post isolado: quem entrou volta pra se ver, quem não entrou quer entrar.

### A decisão que sustenta tudo: entrada por consentimento

**Não se raspa a lista de seguidores.** Duas razões, e a segunda é a que importa
mais:

1. Raspar seguidores viola os termos do Instagram e a punição cai no perfil, não
   no scraper. E nome + foto de pessoa identificável é dado pessoal — coletar
   sem base legal esbarra na LGPD.
2. **A versão com consentimento é melhor para o objetivo.** A pessoa comenta
   uma palavra-chave pra entrar. Isso:
   - torna o consentimento explícito (ela pediu pra aparecer);
   - transforma o post em máquina de comentário, que é justamente o sinal que
     empurra alcance;
   - dá motivo pessoal pra compartilhar — o único conteúdo que a pessoa espalha
     por conta própria é aquele em que ela aparece.

Ou seja: a restrição de privacidade e a alavanca de crescimento apontam para o
mesmo desenho. Não há trade-off.

---

## 2. O caminho técnico — **verificado**

```
comentário na publicação
   ↓  GET /{ig-media-id}/comments?fields=id,text,username,timestamp
username
   ↓  GET /{ig-user-id}?fields=business_discovery.username(USER){username,name,profile_picture_url,followers_count}
nome + foto de perfil + nº de seguidores
   ↓  composição (sharp) + montagem (ffmpeg)
Reel
   ↓  POST /{ig-user-id}/media  →  media_publish
publicado
```

**Custo: zero.** Tudo é Graph API. Nenhuma geração de imagem, nenhum serviço
pago, nenhum scraping.

### Testado em 04/09/2026 contra a conta real

| username | retorno |
|---|---|
| `bruno.lucialdo` | nome, foto, 92.062 seguidores |
| `millersantt` | nome, foto, 3.940 |
| `0_claudio_0` | nome, foto, 254 |
| `viniciuzmartins` | nome, foto, 2.475 |

### Limitação importante

`business_discovery` **só responde para contas profissionais** (comercial ou
criador). Perfil pessoal comum devolve erro. Os quatro acima funcionaram, mas é
amostra enviesada — eram pessoas que comentam em conta de conteúdo de IA.

Numa audiência geral, espere uma fatia relevante de falhas. **Planeje o
fallback desde o começo:** avatar genérico com as iniciais, ou só o `@` sem
foto. Não deixe o vídeo quebrar porque um participante tem conta pessoal.

### O que NÃO existe (testado, todos falham)

```
/{ig-user-id}/followers        →  nonexisting field
?fields=followers              →  nonexisting field
?fields=followed_by            →  nonexisting field
/{ig-media-id}/likes           →  caminho inexistente
```

Não há lista de seguidores em nenhuma versão da API, com nenhum token, nem com
revisão de app. Quem só segue e observa é invisível. Só aparece quem **age** —
comenta, manda DM ou marca.

O que existe de audiência é agregado: `follower_demographics` com recorte por
cidade, país, idade e gênero.

---

## 3. Setup da conta nova

O projeto vai rodar em **outra conta** do Heros, com token próprio.

### Pré-requisitos na conta

1. Perfil do Instagram **profissional** (comercial ou criador)
2. Vinculado a uma **Página do Facebook**
3. A Página dentro de uma **Business Manager** que ele administre

### App na Meta

Um app em `developers.facebook.com`, com o perfil adicionado como **Instagram
Tester** (e o convite aceito). **Não precisa de App Review** para publicar na
própria conta — modo de desenvolvimento com acesso padrão basta.

### Permissões que o token precisa

```
instagram_basic                 ler o perfil
instagram_content_publish       publicar
instagram_manage_comments       ler comentários  ← essencial aqui
```

`instagram_manage_insights` se quiser medir alcance depois.

**Não precisa** de `instagram_manage_messages` (esse exige App Review e
Advanced Access — no projeto irmão ele falhou com
`(#3) Application does not have the capability`).

### Variáveis de ambiente

```
IG_USER_ID=            # id do perfil do Instagram (não é o @)
META_ACCESS_TOKEN=     # token de longa duração
META_APP_ID=
```

⚠️ **Troque o token de usuário por um System User token** antes de virar
produção. Token de usuário expira em 60 dias e derruba a automação sem aviso.

---

## 4. Arquitetura sugerida

Copiar a espinha do `AtenStuduioPosts`, que já roda em produção:

```
src/
  config.js       carrega .env sem dependência (pula se o arquivo não existir,
                  pro runner do Actions funcionar só com secrets)
  coletar.js      lê comentários dos últimos posts, filtra a palavra-chave,
                  resolve username → nome + foto, dedupe por id de comentário
  avatares.js     baixa as fotos, corta em círculo, guarda em cache local
  animar.js       gera os quadros (sharp) e monta o vídeo (ffmpeg)
  publicar.js     Release do GitHub como hospedagem → container → publish
  run.js          orquestra e grava o estado
estado.json       participantes já dentro da estrela + posts publicados
```

### Estado

Guarde **quem já entrou**, com id do comentário como chave de dedupe. A estrela
é cumulativa: cada vídeo tem todo mundo que já entrou, mais os novos. Sem isso
você regera a mesma pessoa toda vez e ela nunca "fica" lá dentro.

### Animação

Frames compostos no `sharp` (avatares em posições calculadas por quadro) e
juntados pelo `ffmpeg`. Sem dependência nova, sem canvas, sem headless browser.

Especificação do Reels: `1080x1920`, `H.264`, `AAC 44.1kHz`, `30fps`,
`≥3500 kbps`, MP4.

---

## 5. Armadilhas já pagas no projeto irmão

Cada uma destas custou tempo. Não descubra de novo.

### Infraestrutura

**O `schedule` do GitHub Actions não funciona.** Três janelas agendadas em dois
dias, zero execuções com `event=schedule`, com toda a configuração correta.
O `workflow_dispatch` do mesmo arquivo respondeu 100% das vezes. **Use um
agendador externo** chamando o `workflow_dispatch` pela API — no projeto irmão é
o `cron-job.org`, gratuito, e dispara no segundo certo.

**O `ffmpeg` NÃO vem no `ubuntu-latest`.** Instale com
`sudo apt-get install -y ffmpeg` (~40s). E **não verifique com pipe**:
`ffmpeg -version | head -1` devolve o código de saída do `head` e passa mesmo
com o binário ausente.

**Hospedagem do vídeo:** a Meta baixa o arquivo uma vez ao criar o container e
nunca mais precisa dele. Não é hospedagem, é entrega. Use **GitHub Releases**
(grátis, não incha o histórico do git) e apague o asset depois de publicar.

### ffmpeg

**`zoompan` conta quadros de saída POR quadro de entrada.** Com imagem em loop
na taxa padrão, 1 segundo pedido vira 25. Use `-framerate 1 -loop 1 -t 1`.

**`concat` resolve caminho relativo à pasta da LISTA**, não ao diretório de
trabalho. Escreva caminho absoluto no `lista.txt`.

**`concat -c copy` quebra a linha do tempo.** A duração sai certa mas seek e
filtros só enxergam o último trecho. Reencode na junção.

**Escale com `force_original_aspect_ratio=increase` antes de cortar.** Fonte
alguns pixels mais larga que 9:16 escala para altura menor que o corte e o
ffmpeg aborta.

**`execFileSync` com `maxBuffer` padrão (1MB)** mata o processo e o sintoma é
`status: null` com stderr vazio — indistinguível de binário ausente. Suba para
32MB e reporte `code`, `signal` e `status` no erro.

### Graph API

**A API ignora parâmetro desconhecido em silêncio.** Testando o rótulo de IA,
ela aceitou até um nome de campo inventado. **Nunca confie em "não deu erro"** —
leia o campo de volta no post publicado e confirme.

**Container de vídeo demora.** Imagem fica pronta em segundos; Reel de 24s levou
20s. Publicar antes do `FINISHED` devolve `Media ID is not available`.

**Áudio:** a API não anexa som do Instagram em nenhum formato. A trilha vai
embutida no arquivo. E **Reel não aceita troca de áudio depois de publicado** —
o "Substituir áudio" só existe para post de feed e carrossel.

⚠️ **Use música da Meta Sound Collection** (Business Suite → Ferramentas →
Coleção de Sons). Conta profissional fica restrita a esse catálogo, e música
comercial embutida faz o Instagram mutar o Reel. Sem conserto depois.

### Política

⚠️ **Desde 31/08/2026 o Instagram reduz alcance e tira das recomendações
conteúdo com pessoas geradas por IA sem rótulo.** Se este projeto usar qualquer
imagem sintética, declare com `is_ai_generated: 'true'` na criação do container
(no carrossel vai só no container pai — no filho dá erro).

Se usar só fotos reais de perfil dos participantes, não se aplica.

---

## 5b. Semear a estrela com grandes nomes

Pedido do Heros: além dos participantes, colocar figuras como **Elon Musk, Bill
Gates, Steve Jobs, Jordan Belfort e Flávio Augusto** entrando desde o começo —
para criar a sensação de *"é lá que eu quero estar"*.

A ideia funciona: gente entra em lista onde já tem gente que admira. É o mesmo
mecanismo de prova social de um line-up de festival.

### De onde vêm as fotos

`business_discovery` resolve alguns, mas **não todos**:

- **têm perfil profissional no Instagram** — Bill Gates (`@thisisbillgates`),
  Flávio Augusto (`@flavioaugustosilva`), possivelmente Elon (`@elonmusk`,
  pouco ativo). Nesses o caminho é o mesmo dos participantes, custo zero.
- **não têm perfil** — Steve Jobs (falecido em 2011) e Jordan Belfort não
  resolvem por essa via.

Para os que não resolvem, a foto teria que vir de outro lugar — e aí muda a
natureza do que se está fazendo.

### O que pesar antes de fazer

Não é o mesmo caso dos participantes, que **pediram** para entrar. Aqui são
pessoas reais, identificáveis, usadas sem pedir.

Na prática, uso de imagem de figura pública em conteúdo editorial ou humorístico
é comum e raramente vira problema. O que muda a temperatura é:

- **sugerir endosso.** Se o vídeo dá a entender que o Elon Musk segue a conta ou
  participa da brincadeira, deixa de ser referência e vira alegação falsa.
  Deixar visualmente claro que é uma homenagem/piada, não uma lista de
  seguidores reais, resolve a maior parte do risco.
- **Steve Jobs.** Pessoa falecida, e a família é conhecida por proteger a
  imagem dele. Vale considerar se ele acrescenta o suficiente para valer.
- **Jordan Belfort.** É o "Lobo de Wall Street" de verdade — condenado por
  fraude. Como símbolo de aspiração financeira, carrega uma leitura que pode
  não ser a pretendida.

**Sugestão:** separar visualmente as duas camadas. Os grandes nomes como
"estrelas fixas" já no céu, com tratamento diferente, e os participantes como
os que estão sendo atraídos. Isso entrega a aspiração sem afirmar que eles são
seguidores.

### Implementação

Uma lista fixa em configuração, com foto local para quem não resolve por API:

```
config/estrelas-fixas.json
  [{ "nome": "Bill Gates", "user": "thisisbillgates" },
   { "nome": "Steve Jobs", "foto": "assets/estrelas/jobs.jpg" }]
```

Elas entram em todo vídeo desde o primeiro, e não contam para a massa que
dispara o buraco negro — senão a meta de 1 milhão vira decorativa.

---

## 6. Pontos em aberto para decidir

**Palavra-chave da entrada.** Precisa ser curta, inconfundível e diferente do
`PROMPT` que o `@atenstudio.ai` já usa. Ex: `ESTRELA`.

**Quantos avatares cabem na tela.** Com 172 participantes ainda dá para ver cada
um; com 10.000, não. Defina desde já como o vídeo se comporta quando a massa
crescer — provavelmente destacando os N mais recentes e o resto virando partícula.

**O gatilho do buraco negro.** Se a meta é 1 milhão de seguidores e a conta
começa pequena, a série pode durar muito. Vale ter marcos intermediários
(10 mil, 100 mil) com mudança visual, senão o público não percebe progresso.

**Fallback de avatar.** Definir antes de publicar, não depois: conta pessoal não
responde ao `business_discovery`.

**Frequência.** No projeto irmão, 4 posts em 18h numa base pequena derrubou o
alcance de todos. Espaçar importa mais do que volume.

---

## 7. Do que o projeto irmão pode ser copiado

`/Users/herossales/Documents/Claude Code Projetos/AtenStuduioPosts`

| arquivo | serve para |
|---|---|
| `src/config.js` | carregar `.env` sem dependência, compatível com Actions |
| `src/reels/publicar.js` | Release → container REELS → publish → limpa o asset |
| `src/reels/montar.js` | segmentos, concat, trilha, capa — com os comentários das armadilhas |
| `src/storage.js` | upload pela Contents API do GitHub |
| `.github/workflows/reels.yml` | instalar ffmpeg, baixar assets de Release, publicar |

---

## 8. Estado de conhecimento sobre alcance (contexto, não conclusão)

Medido no `@atenstudio.ai` entre 02 e 04/09/2026, base de ~172 seguidores:

```
6 Reels publicados:  140, 20, 13, 12, 7, 6 de alcance
```

Um acerto e cinco medianos. Duas hipóteses foram levantadas e **nenhuma está
confirmada**: `share_to_feed` mandando o Reel para o ranking de feed, e a
penalização de conteúdo de IA sem rótulo.

**Não trate nenhuma como fato.** O erro cometido lá foi cravar causa com um
único ponto de dado de um lado da comparação. Se este projeto for medir alguma
coisa, mude uma variável de cada vez e deixe rodar uma semana antes de concluir.
