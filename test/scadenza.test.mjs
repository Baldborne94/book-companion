// QUANDO SCADE LA CHIAVE DELL'ORACOLO.
//
// La data NON si può chiedere all'API: la scadenza vive nell'Admin API di
// Anthropic, che vuole una chiave di amministrazione — e mandarne una dal
// browser sarebbe una pessima idea. Con la chiave normale l'unica cosa che
// si scopre è che non vale più, e la si scopre il giorno dopo, con un 401
// in faccia mentre stavi leggendo (chiesto dal lettore: «almeno dimmi
// quando scade, così posso già inserirla il giorno prima»).
//
// Quindi la data la scrive lui, e tutto il valore sta in due conti che
// sbagliano in silenzio: quanti giorni mancano, e cosa scrivere.
const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const { statoChiave, frasScadenza, daAvvisare, leggiScadenza, scriviScadenza, GIORNI_AVVISO } =
  await import("../src/lib/oracle.js");

const il = (s) => Date.parse(s);
const stato = (scade, quando) => statoChiave({ scade, ora: il(quando) });
const frase = (scade, quando) => frasScadenza(stato(scade, quando));

export default async function (t) {
  // ---- i giorni si contano sul CALENDARIO, non sulle ore ---------------
  //
  // È la trappola vera. Sottraendo istanti, una chiave che scade domani
  // mattina e una che scade domani sera darebbero «0» e «1» a seconda
  // dell'ora in cui apri l'app — e il giorno che conta è proprio quello.
  t.eq("scade oggi, guardata all'alba", stato("2026-09-01", "2026-09-01T06:00:00").giorni, 0);
  t.eq("scade oggi, guardata a notte fonda", stato("2026-09-01", "2026-09-01T23:30:00").giorni, 0);
  t.eq("domani è 1, non 0", stato("2026-09-02", "2026-09-01T23:30:00").giorni, 1);
  t.eq("ieri è -1", stato("2026-08-31", "2026-09-01T00:10:00").giorni, -1);

  // IL CAMBIO D'ORA. L'ultima domenica di ottobre la notte dura 25 ore: coi
  // millisecondi il conto scivola di un giorno intero proprio a cavallo del
  // cambio. Fissando i due capi a mezzogiorno il numero resta vero.
  t.eq(
    "il cambio d'ora non sposta il conto",
    stato("2026-10-26", "2026-10-24T12:00:00").giorni,
    2
  );

  // ---- i tre stati -----------------------------------------------------
  t.eq("una data lontana è solo valida", stato("2026-12-31", "2026-09-01T10:00:00").stato, "valida");
  t.eq("dentro la finestra si avvisa", stato("2026-09-05", "2026-09-01T10:00:00").stato, "inScadenza");
  t.eq("il giorno stesso si avvisa ancora", stato("2026-09-01", "2026-09-01T10:00:00").stato, "inScadenza");
  t.eq("passata la data è scaduta", stato("2026-08-30", "2026-09-01T10:00:00").stato, "scaduta");
  // il bordo esatto della finestra, che è il posto dove un `<` al posto di
  // un `<=` non lo nota nessuno
  const bordo = new Date(il("2026-09-01T10:00:00") + GIORNI_AVVISO * 86400000);
  const iso = `${bordo.getFullYear()}-${String(bordo.getMonth() + 1).padStart(2, "0")}-${String(bordo.getDate()).padStart(2, "0")}`;
  t.eq("l'ultimo giorno della finestra ci sta dentro", stato(iso, "2026-09-01T10:00:00").stato, "inScadenza");

  // ---- senza data non si inventa niente --------------------------------
  // «Ignota» NON è «valida»: una chiave di cui non sappiamo la scadenza non
  // va dichiarata a posto, va lasciata in silenzio. Dire «valida» sarebbe
  // una rassicurazione che non abbiamo modo di dare.
  for (const niente of ["", null, undefined, "domani", "2026-13-45x"]) {
    t.eq(`«${String(niente)}» non è una data`, stato(niente, "2026-09-01T10:00:00").stato, "ignota");
  }
  t.eq("e senza data non c'è niente da scrivere", frase("", "2026-09-01T10:00:00"), null);

  // ---- la frase, che è quello che si legge ------------------------------
  // «scade fra 0 giorni» non lo direbbe nessuno, e «1 giorni» si legge come
  // un guasto: sono i due casi che una formula sola sbaglia sempre.
  t.eq("oggi si dice oggi", frase("2026-09-01", "2026-09-01T10:00:00"), "La chiave scade oggi.");
  t.eq("domani si dice domani", frase("2026-09-02", "2026-09-01T10:00:00"), "La chiave scade domani.");
  t.eq("più in là si contano i giorni", frase("2026-09-06", "2026-09-01T10:00:00"), "La chiave scade fra 5 giorni.");
  t.eq("ieri si dice ieri", frase("2026-08-31", "2026-09-01T10:00:00"), "La chiave è scaduta ieri.");
  t.eq("più indietro si contano", frase("2026-08-29", "2026-09-01T10:00:00"), "La chiave è scaduta 3 giorni fa.");
  t.c(
    "e la scadenza non si scrive mai al plurale sbagliato",
    !/fra 1 giorni|1 giorni fa/.test(
      [frase("2026-09-02", "2026-09-01T10:00:00"), frase("2026-08-31", "2026-09-01T10:00:00")].join(" ")
    )
  );

  // ---- l'avviso all'avvio: UNA VOLTA AL GIORNO -------------------------
  //
  // Un avviso che torna a ogni avvio si impara a chiudere senza leggerlo, ed
  // è proprio il giorno che conta che non lo guarderesti.
  localStorage.removeItem("bc_ai_key_avviso");
  const vicina = { stato: "inScadenza", giorni: 2 };
  t.c("la prima volta si dice", !!daAvvisare({ ora: il("2026-09-01T09:00:00"), stato: vicina }));
  t.eq(
    "la seconda volta nello stesso giorno no",
    daAvvisare({ ora: il("2026-09-01T21:00:00"), stato: vicina }),
    null
  );
  t.c(
    "ma il giorno dopo sì",
    !!daAvvisare({ ora: il("2026-09-02T08:00:00"), stato: vicina })
  );
  // e una chiave lontana o senza data non disturba nessuno
  localStorage.removeItem("bc_ai_key_avviso");
  t.eq("una chiave lontana non avvisa", daAvvisare({ ora: il("2026-09-01T09:00:00"), stato: { stato: "valida", giorni: 90 } }), null);
  t.eq("e nemmeno una senza data", daAvvisare({ ora: il("2026-09-01T09:00:00"), stato: { stato: "ignota", giorni: null } }), null);

  // ---- quel che si scrive nello storage --------------------------------
  scriviScadenza("2026-09-30");
  t.eq("una data si ricorda", leggiScadenza(), "2026-09-30");
  scriviScadenza("");
  t.eq("e si può togliere", leggiScadenza(), "");
  scriviScadenza("il 30 settembre");
  t.eq("una data storta non entra", leggiScadenza(), "");
}
