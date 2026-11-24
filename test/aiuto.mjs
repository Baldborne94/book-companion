// Il minimo per scrivere un controllo: niente libreria, niente dipendenze.
// Un test e' un file `*.test.mjs` che esporta `default async (t) => {...}`
// e chiama `t.c` / `t.eq` / `t.vicino`. Il corridore fa il resto.

export function banco() {
  const guai = [];
  let ok = 0;
  const t = {
    // il controllo nudo: nome, condizione, e cosa si e' visto se fallisce
    c(nome, cond, extra = "") {
      if (cond) ok += 1;
      else guai.push(`${nome}${extra ? ` — ${extra}` : ""}`);
    },
    eq(nome, a, b) {
      t.c(nome, a === b, `atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`);
    },
    // per i pixel: il motore arrotonda, e pretendere l'uguaglianza esatta
    // vuol dire un test che fallisce a caso su un altro schermo
    vicino(nome, a, b, tol = 0.6) {
      t.c(nome, Math.abs(a - b) <= tol, `atteso ~${b}, ottenuto ${a}`);
    },
  };
  return { t, esito: () => ({ ok, guai }) };
}

// Un test puo' dichiararsi SALTATO invece che fallito: serve alle prove che
// hanno bisogno di un browser vero. Saltare non e' passare, e il corridore
// lo stampa in chiaro — un test che non gira non protegge niente.
export class Saltato extends Error {
  constructor(perche) {
    super(perche);
    this.saltato = true;
  }
}
