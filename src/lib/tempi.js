// I TEMPI DELL'APP MISURATI SUL TABLET DEL LETTORE (chiesto: «fai la 1»,
// cioe' misurare l'avvio, l'apertura di un ePub e di un PDF e la Libreria
// con mille libri, e curare solo cio' che risulta lento). Come le voltate
// (`lib/voltate.js`): ogni misura e' una fila di tappe in millisecondi, e
// il riassunto va nel rapporto dei guasti che il lettore copia lui. Niente
// titoli, niente nomi: numeri, e quanti libri ci sono.

import { quantile, sec } from "./voltate.js";

const KEY = "bc_tempi";
export const TENUTI = 120;

// la partenza di una misura che finisce in un altro componente (il tocco
// su «Leggi» in App, la pagina che compare nel reader): una sola alla
// volta, e chi finisce la prende solo se e' sua
let inCorso = null;
export function parti(cosa, t0 = adesso()) {
  inCorso = { cosa, t0 };
}
export function partenza(cosa) {
  const p = inCorso;
  if (!p || p.cosa !== cosa) return null;
  inCorso = null;
  return p.t0;
}

const adesso = () => globalThis.performance?.now?.() ?? Date.now();

// dopo che il browser ha davvero disegnato: il fotogramma che parte, poi
// il giro subito dopo di lui
export function dopoIlDisegno(fatto, { raf = globalThis.requestAnimationFrame } = {}) {
  if (!raf) return fatto(adesso());
  raf(() => setTimeout(() => fatto(adesso()), 0));
}

// L'AVVIO: dalla navigazione (lo zero di `performance.now`) al codice che
// parte (`main.jsx`: pagina e pacchetto scesi e letti), poi al primo
// disegno dell'app. Una volta per vita della pagina, anche se React monta
// due volte
let codice = null;
let avvioSegnato = false;
export function codiceArrivato(t = adesso()) {
  codice = t;
}
export function segnaAvvio({ n = 0, segna = segnaTempo, raf } = {}) {
  if (avvioSegnato || codice == null) return;
  avvioSegnato = true;
  const tc = codice;
  dopoIlDisegno((t) => segna(vocePerTempo({ cosa: "avvio", t0: 0, tappe: [["codice", tc], ["primo", t]], n })), { raf });
}

// L'APERTURA DI UN LIBRO: dal tocco su «Leggi» (`parti` in App) alla
// prima pagina disegnata, con le tappe che il reader segna strada facendo.
// Riaperto senza tocco (il reader che riparte da un segno) conta dal
// montaggio
export function misuraApertura(cosa, id, { segna = segnaTempo, raf } = {}) {
  const t0 = partenza(`lettura:${id}`) ?? adesso();
  const tappe = [];
  const dati = {};
  let fatta = false;
  return {
    tappa(nome, extra = {}) {
      if (fatta) return;
      tappe.push([nome, adesso()]);
      Object.assign(dati, extra);
    },
    fine() {
      if (fatta) return;
      fatta = true;
      dopoIlDisegno((t) => segna(vocePerTempo({ cosa, t0, tappe: [...tappe, ["pagina", t]], ...dati })), { raf });
    },
  };
}

// da dove arrivano i byte di un reader (`fileDaLeggere`)
export const provenienza = (blob) => (blob?.daLontano ? "pezzi" : blob?.lontano ? "drive" : "tablet");

// le tappe sono istanti in fila; nella voce restano le durate fra l'una e
// l'altra (la prima dalla partenza)
export function vocePerTempo({ cosa, t0, tappe, ora = Date.now(), ...extra }) {
  const f = {};
  let prima = t0;
  for (const [nome, t] of tappe) {
    f[nome] = Math.round(t - prima);
    prima = t;
  }
  const resto = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "" && v !== null));
  return { q: ora, c: cosa, f, ...resto };
}

const leggi = (st) => {
  try {
    const v = JSON.parse(st.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export function segnaTempo(voce, { st = globalThis.localStorage, tenuti = TENUTI } = {}) {
  try {
    st.setItem(KEY, JSON.stringify([...leggi(st), voce].slice(-tenuti)));
  } catch {
    /* una misura che non si scrive non deve fermare niente */
  }
}

export const tempiAnnotati = (st = globalThis.localStorage) => {
  try {
    return leggi(st);
  } catch {
    return [];
  }
};

export function svuotaTempi(st = globalThis.localStorage) {
  try {
    st.removeItem(KEY);
  } catch {
    /* niente */
  }
}

const tot = (v) => Object.values(v.f || {}).reduce((a, b) => a + b, 0);

const NOMI = {
  avvio: "Avvio dell'app",
  libreria: "Libreria aperta",
  epub: "ePub aperto",
  pdf: "PDF aperto",
};
const TAPPE = {
  pagina: "pagina pronta",
  disegno: "disegno",
  codice: "codice",
  byte: "byte",
  libro: "libro letto",
  impagina: "impaginazione",
  primo: "primo disegno",
};
const DA = { tablet: "dal tablet", drive: "da Drive", pezzi: "da Drive a pezzi", scaffale: "a scaffale", raccolte: "a raccolte" };
const via = (v) => v.da || v.vista;

function riga(nome, vv) {
  const t = vv.map(tot);
  const tappe = [...new Set(vv.flatMap((v) => Object.keys(v.f || {})))];
  const lente = t.filter((x) => x > 2000).length;
  const n = vv.map((v) => v.n).filter((x) => x > 0);
  return (
    `${nome}: ${vv.length} · tipica ${sec(quantile(t, 0.5))}` +
    (tappe.length > 1 ? ` (${tappe.map((k) => `${TAPPE[k] || k} ${sec(quantile(vv.map((v) => v.f?.[k] || 0), 0.5))}`).join(" + ")})` : "") +
    ` · 9 su 10 entro ${sec(quantile(t, 0.9))} · la peggiore ${sec(Math.max(...t))}` +
    (n.length ? ` · ${quantile(n, 0.5)} libri` : "") +
    (lente ? ` · oltre i 2 secondi: ${lente}` : "")
  );
}

// Le righe per il rapporto: una per misura, i libri per provenienza
export function righeTempi(voci = []) {
  if (!voci.length) return [];
  const out = [`Tempi misurati: ${voci.length}`];
  for (const c of Object.keys(NOMI)) {
    const qui = voci.filter((v) => v.c === c);
    if (!qui.length) continue;
    const provenienze = [...new Set(qui.map(via).filter(Boolean))];
    if (provenienze.length < 2) out.push(riga(`${NOMI[c]}${provenienze.length ? ` ${DA[provenienze[0]] || provenienze[0]}` : ""}`, qui));
    else for (const da of provenienze) out.push(riga(`${NOMI[c]} ${DA[da] || da}`, qui.filter((v) => via(v) === da)));
  }
  const lente = voci.filter((v) => tot(v) > 2000).slice(-5);
  if (lente.length) {
    out.push("Le ultime lente:");
    for (const v of lente)
      out.push(
        `  ${new Date(v.q).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · ${NOMI[v.c] || v.c}${via(v) ? ` ${DA[via(v)] || via(v)}` : ""} · ` +
          Object.entries(v.f || {}).map(([k, ms]) => `${TAPPE[k] || k} ${sec(ms)}`).join(" + ") +
          (v.kb ? ` · ${Math.round(v.kb / 102.4) / 10} MB` : "") +
          (v.n ? ` · ${v.n} libri` : "")
      );
  }
  return out;
}
