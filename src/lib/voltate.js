// LE VOLTATE DEI FUMETTI MISURATE SUL TABLET DEL LETTORE (chiesto: «fai la
// 2», cioe' misurare dove vanno i secondi di una voltata lenta). Il banco
// col Drive finto non riproduceva la lentezza che il lettore vede: rete,
// Drive o il tablet che decodifica? Qui ogni voltata annota due tempi —
// quanto hanno messo i byte ad arrivare (`pagine`) e quanto il tablet a
// disegnarli (`disegno`) — e in che stato erano le pagine quando le hai
// chieste: gia' pronte in memoria, in arrivo (preparate in anticipo e non
// ancora finite), o chieste sul momento. Il riassunto va nel rapporto dei
// guasti, che il lettore copia lui. Niente titoli, niente nomi: numeri.

const KEY = "bc_voltate";
export const TENUTE = 200;

// lo stato delle pagine a schermo in una lettera, dalla peggiore: basta una
// pagina chiesta sul momento perche' la voltata aspetti la rete
export function statoDelle(stati) {
  if (stati.includes("da chiedere")) return "C";
  if (stati.includes("in arrivo")) return "A";
  return "P";
}

export function vocePerVoltata({ t0, tPagine, tVista, stati = [], da = "tablet", doppia = false, kb = 0, prima = false, rete = "", ora = Date.now() }) {
  return {
    q: ora,
    pagine: Math.max(0, Math.round(tPagine - t0)),
    disegno: Math.max(0, Math.round(tVista - tPagine)),
    s: statoDelle(stati),
    da,
    ...(doppia ? { d: 1 } : {}),
    kb: Math.round(kb),
    ...(prima ? { p: 1 } : {}),
    ...(rete ? { r: rete } : {}),
  };
}

const leggi = (st) => {
  try {
    const v = JSON.parse(st.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export function segnaVoltata(voce, { st = globalThis.localStorage, tenute = TENUTE } = {}) {
  try {
    st.setItem(KEY, JSON.stringify([...leggi(st), voce].slice(-tenute)));
  } catch {
    /* una misura che non si scrive non deve fermare la lettura */
  }
}

export const voltateAnnotate = (st = globalThis.localStorage) => {
  try {
    return leggi(st);
  } catch {
    return [];
  }
};

export function svuotaVoltate(st = globalThis.localStorage) {
  try {
    st.removeItem(KEY);
  } catch {
    /* niente */
  }
}

export const quantile = (xs, q) => {
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(q * o.length))];
};
const tot = (v) => v.pagine + v.disegno;
export const sec = (ms) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);

const STATI = { P: "già pronte in memoria", A: "in arrivo (preparate prima)", C: "chieste sul momento" };

function riga(nome, vv) {
  const t = vv.map(tot);
  const lente = t.filter((x) => x > 1000).length;
  return (
    `${nome}: ${vv.length} · tipica ${sec(quantile(t, 0.5))} (byte ${sec(quantile(vv.map((v) => v.pagine), 0.5))} + disegno ${sec(quantile(vv.map((v) => v.disegno), 0.5))})` +
    ` · 9 su 10 entro ${sec(quantile(t, 0.9))} · la peggiore ${sec(Math.max(...t))}${lente ? ` · oltre il secondo: ${lente}` : ""}`
  );
}

// Le righe per il rapporto: le aperture a parte (contano l'archivio che si
// apre), e le voltate per provenienza e per stato delle pagine
export function righeVoltate(voci = []) {
  if (!voci.length) return [];
  const aperture = voci.filter((v) => v.p);
  const voltate = voci.filter((v) => !v.p);
  const out = [`Voltate dei fumetti misurate: ${voltate.length}${aperture.length ? ` (più ${aperture.length} ${aperture.length === 1 ? "apertura" : "aperture"})` : ""}`];
  for (const da of ["drive", "tablet"]) {
    const qui = voltate.filter((v) => v.da === da);
    if (!qui.length) continue;
    out.push(riga(da === "drive" ? "Da Drive" : "Dal tablet", qui));
    for (const s of ["P", "A", "C"]) {
      const cc = qui.filter((v) => v.s === s);
      if (cc.length) out.push(`  ${riga(STATI[s], cc)}`);
    }
    const doppie = qui.filter((v) => v.d);
    if (doppie.length && doppie.length < qui.length) out.push(`  ${riga("a doppia pagina", doppie)}`);
  }
  if (aperture.length) out.push(riga("Prima pagina all'apertura", aperture));
  const kb = voltate.map((v) => v.kb).filter((x) => x > 0);
  if (kb.length) out.push(`Peso tipico di quel che si volta: ${Math.round(quantile(kb, 0.5) / 1024 * 10) / 10} MB`);
  const reti = [...new Set(voci.map((v) => v.r).filter(Boolean))];
  if (reti.length) out.push(`Rete secondo il browser: ${reti.join(", ")}`);
  const lente = [...voltate].filter((v) => tot(v) > 1000).slice(-5);
  if (lente.length) {
    out.push("Le ultime voltate lente:");
    for (const v of lente) out.push(`  ${new Date(v.q).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · ${v.da} · ${STATI[v.s]}${v.d ? " · doppia" : ""} · byte ${sec(v.pagine)} + disegno ${sec(v.disegno)} · ${Math.round(v.kb / 102.4) / 10} MB`);
  }
  return out;
}
