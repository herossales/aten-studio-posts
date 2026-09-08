/* A legenda do post. Curta, e começa pela chamada: no feed o Instagram corta
   depois da primeira linha, então o que precisa ser lido tem de estar nela. */
import R from './regua.js';
import { CHAVE } from './narracao.js';
import { marca } from './marca.js';

export function legenda({ dia, antes, depois }) {
  const l = [`Comente: ${CHAVE}`, ''];

  if (depois >= R.META) {
    l.push(`Um milhão de pessoas dentro. ${R.fmtMassa(R.massa(depois))} — maior que o TON 618, o maior que a humanidade já mediu.`);
  } else if (R.fase(antes) !== R.fase(depois)) {
    l.push(`A estrela não aguentou. Explodiu com ${R.fmt(depois)} pessoas dentro e sobrou ${R.fmtMassa(R.massa(depois))}.`);
    l.push('Nasceu o buraco negro.');
  } else if (antes === 0 && depois === 0) {
    l.push('Cada pessoa que entra dá massa à estrela. Quando ela não aguentar mais, colapsa — e nasce o buraco negro.');
    l.push('');
    l.push('Meta: 1 milhão dentro. Hoje: 0.');
  } else {
    const maiuscula = t => t[0].toUpperCase() + t.slice(1);
    const estado = R.fase(depois) === 'estrela'
      ? `${maiuscula(R.estrela(depois).estagio.nome)}, ${R.fmtMassa(R.massa(depois))}`
      : `${R.fmtMassa(R.massa(depois))}, horizonte de ${R.fmtKm(R.raioHorizonteKm(depois))}`;
    l.push(`${R.fmt(depois)} dentro${depois > antes ? `, ${R.fmt(depois - antes)} entraram hoje` : ''}. ${estado}.`);
    const m = R.proximoMarco(depois);
    if (m) l.push(`Faltam ${R.fmt(m.n - depois)} para ${m.nota}.`);
  }

  l.push('', `Seja bem-vindo ao clube. Siga @${marca.conta}`, '',
         '#buraconegro #singularidade #mentalidade #milhao');
  return l.join('\n');
}
