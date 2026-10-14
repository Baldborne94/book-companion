// SENZA GOOGLE DRIVE PER SCELTA (chiesto dal lettore: «eliminiamo del tutto
// l'uso del googledrive»). Lo scollegamento di prima non teneva: il
// prossimo ingresso con Google consegnava una chiave nuova e Drive si
// riaccendeva da solo, e cosi' il rinnovo dal server. Qui la scelta resiste
// a tutt'e due, l'ingresso con Google non chiede piu' Drive, e prima di
// spegnere si dice per nome quel che sta solo lassu'.
import { soloSuDrive, fraseSoloSuDrive } from "../src/lib/driveCore.js";
import { entraConGoogle, custodisciGoogle, SCOPE_DRIVE } from "../src/lib/accessoGoogle.js";

function memoria() {
  const m = {};
  const st = {};
  for (const [k, f] of Object.entries({
    getItem: (x) => (x in m ? m[x] : null),
    setItem: (x, v) => (m[x] = String(v)),
    removeItem: (x) => delete m[x],
  }))
    Object.defineProperty(st, k, { value: f, enumerable: false });
  return st;
}

export default async (t) => {
  // ---- quel che sta solo su Drive ------------------------------------------
  const libri = [
    { id: "a", title: "Sandman Deluxe Book 03" },
    { id: "b", title: "Sul tablet" },
    { id: "c", title: "Sul disco", fileTolto: true },
    { id: "d", title: "Mai stato su Drive" },
  ];
  const mappa = { a: { id: "fa" }, b: { id: "fb" }, c: { id: "fc" } };
  const melodie = [
    { id: "m1", name: "Pioggia", drive: true, trackId: "T1" },
    { id: "m2", name: "Camino", drive: true, trackId: "T2" },
    { id: "m3", name: "Dal tablet", trackId: "T3" },
    { id: "m4", name: "Tolta", drive: true, trackId: "T4", deleted: true },
  ];
  const lassu = soloSuDrive({ libri, mappa, qui: new Set(["b"]), melodie, tracce: new Set(["T2", "T3"]) });
  t.eq("solo lassu': il libro che Drive ha e il dispositivo no", lassu.libri.map((b) => b.id).join(), "a");
  t.eq("…e la melodia che da qui si suona solo da Drive", lassu.melodie.map((m) => m.id).join(), "m1");
  t.eq(
    "si dice per nome, prima di spegnere",
    fraseSoloSuDrive(lassu),
    "«Sandman Deluxe Book 03» e una melodia stanno solo su Google Drive: spento Drive, da qui non si aprono finché non li rimetti sul dispositivo o sul disco."
  );
  t.eq(
    "un libro solo",
    fraseSoloSuDrive({ libri: [libri[0]], melodie: [] }),
    "«Sandman Deluxe Book 03» sta solo su Google Drive: spento Drive, da qui non si apre finché non lo rimetti sul dispositivo o sul disco."
  );
  const tanti = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, title: `V${i}` }));
  t.eq("tre titoli e poi il conto", fraseSoloSuDrive({ libri: tanti, melodie: [] }).split(" stanno")[0], "«V0», «V1», «V2» e altri 2");
  t.eq("niente lassu', niente avviso", fraseSoloSuDrive({ libri: [], melodie: [] }), null);

  // ---- entrare con Google, a Drive spento ----------------------------------
  let oauth = null;
  const sb = { auth: { signInWithOAuth: async (o) => ((oauth = o), { error: null }) }, from: () => ({ upsert: async () => ({ error: null }) }) };
  await entraConGoogle({ sb, origine: "https://book.example", conDrive: false });
  t.c("Drive spento: Google non chiede il permesso per Drive", !oauth.options.scopes && oauth.options.redirectTo === "https://book.example");
  t.c("…e non ne lascia uno a lungo termine", !oauth.options.queryParams);
  await entraConGoogle({ sb, origine: "https://book.example", conDrive: true });
  t.eq("acceso: come sempre", oauth.options.scopes, SCOPE_DRIVE);

  const accettate = [];
  const esito = await custodisciGoogle(
    { provider_token: "ya29.chiave-dell-ingresso", provider_refresh_token: "rt", user: { id: "u1" } },
    { sb, st: memoria(), accetta: (c) => accettate.push(c), spento: () => true }
  );
  t.c("la chiave che arriva entrando non si tiene", !esito.chiave && accettate.length === 0);

  // ---- la scelta dentro drive.js -------------------------------------------
  const vecchio = globalThis.localStorage;
  globalThis.localStorage = memoria();
  const drive = await import("../src/lib/drive.js");
  try {
    await drive.scollegaDrive();
    let rinnovi = 0;
    drive.impostaRinnovo(async () => ((rinnovi += 1), { chiave: "k1", scade: Date.now() + 3_600_000 }));
    t.eq("acceso, il rinnovo collega", await drive.collegaDrive(), true);
    t.c("…e Drive e' acceso", drive.driveAcceso() && drive.driveProntoOra());

    await drive.spegniDrive();
    t.c("spento: niente chiave, niente Drive", drive.senzaDrive() && !drive.driveAcceso() && !drive.driveProntoOra());
    drive.impostaRinnovo(async () => ((rinnovi += 1), { chiave: "k2", scade: Date.now() + 3_600_000 }));
    rinnovi = 0;
    await entraConGoogle({ sb, origine: "https://book.example" });
    t.c("l'ingresso dal pannello, a Drive spento, non chiede Drive", !oauth.options.scopes && !oauth.options.queryParams);
    t.c("il rinnovo dal server non lo riaccende", !(await drive.rinnovaInSilenzio()) && rinnovi === 0 && !drive.driveAcceso());
    drive.accettaChiave({ chiave: "ya29.ingresso", scade: Date.now() + 3_600_000 });
    t.c("la chiave dell'ingresso con Google nemmeno", !drive.driveAcceso() && !drive.driveProntoOra());
    let caduto = null;
    await drive.collegaDrive().catch((e) => (caduto = e));
    t.c("chi chiede Drive sente che e' spento", caduto instanceof drive.DriveSpento && caduto instanceof drive.DriveScollegato);
    t.eq("…e lo dice con le sue parole", drive.fraseScollegato(caduto, "solita"), caduto.message);

    drive.riprendiDrive();
    t.eq("ripreso, si ricollega", await drive.collegaDrive(), true);
    t.c("…e Drive e' di nuovo acceso", !drive.senzaDrive() && drive.driveAcceso());
  } finally {
    await drive.scollegaDrive();
    drive.impostaRinnovo(null);
    if (vecchio === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = vecchio;
  }
};
