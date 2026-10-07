// UN ACCESSO SOLO, E GOOGLE CHE NON CHIEDE PIU' (`accessoGoogle.js` e il
// rinnovo in `drive.js`). Sbaglia in silenzio in modi diversi: riprendere a
// ogni avvio la chiave vecchia della sessione salvata (sembra buona, e' una
// chiave di ieri), bussare al server a ogni avvio anche senza permesso,
// aprire la finestra di Google a chi ha il rinnovo, lasciar cadere un lavoro
// su una chiave ritirata a meta', o cancellare uscendo il permesso che
// serve anche all'altro dispositivo.
import { custodisciGoogle, entraConGoogle, rinnovoDalServer, lasciaGoogleQui, statoRinnovo, rientroConGoogle, SCOPE_DRIVE } from "../src/lib/accessoGoogle.js";

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

function supabaseFinto({ errore = null } = {}) {
  const scritte = [];
  const cancellate = [];
  let oauth = null;
  return {
    scritte,
    cancellate,
    oauth: () => oauth,
    auth: { signInWithOAuth: async (o) => ((oauth = o), { error: null }) },
    from: (tabella) => ({
      upsert: async (riga) => (scritte.push({ tabella, riga }), { error: errore }),
      delete: () => ({ eq: async (k, v) => (cancellate.push({ tabella, k, v }), { error: null }) }),
    }),
  };
}

export default async (t) => {
  // ---- entrare con Google ---------------------------------------------------
  const sb = supabaseFinto();
  await entraConGoogle({ sb, origine: "https://book.example" });
  const o = sb.oauth();
  t.eq("da Google, e di ritorno qui", `${o.provider} ${o.options.redirectTo}`, "google https://book.example");
  t.eq("col permesso per Drive", o.options.scopes, SCOPE_DRIVE);
  t.eq("a lungo termine, anche a chi l'aveva gia' dato", JSON.stringify(o.options.queryParams), JSON.stringify({ access_type: "offline", prompt: "consent" }));

  // ---- quel che arriva con la sessione ---------------------------------------
  const st = memoria();
  const accettate = [];
  const accetta = (c) => accettate.push(c);
  const sessione = { provider_token: "ya29.prima-chiave-lunga", provider_refresh_token: "rt-1", user: { id: "u1" } };
  st.setItem("bc_google_rinnovo", "revocato");
  const esito = await custodisciGoogle(sessione, { sb, st, accetta, ora: 1000 });
  t.eq("la chiave a Drive, e il permesso nel Supabase", JSON.stringify(esito), JSON.stringify({ chiave: true, permesso: "salvato" }));
  t.eq("…la chiave con un minuto di margine", JSON.stringify(accettate[0]), JSON.stringify({ chiave: "ya29.prima-chiave-lunga", scade: 1000 + 59 * 60_000 }));
  t.eq("…il permesso nella riga dell'utente", `${sb.scritte[0].tabella} ${sb.scritte[0].riga.user_id} ${sb.scritte[0].riga.token}`, "google_refresh u1 rt-1");
  t.eq("rientrare con Google toglie il fermo di prima", statoRinnovo(st), "");
  const ancora = await custodisciGoogle(sessione, { sb, st, accetta, ora: 99_999_999 });
  t.c("la sessione salvata ripete la chiave a ogni avvio: vecchia, non si riprende", !ancora.chiave && accettate.length === 1 && sb.scritte.length === 1);
  t.eq("senza chiave nella sessione (entrato con la password) niente", (await custodisciGoogle({ user: { id: "u1" } }, { sb, st, accetta })).chiave, false);
  const soloChiave = await custodisciGoogle({ provider_token: "ya29.seconda-chiave-lunga", user: { id: "u1" } }, { sb, st, accetta });
  t.eq("una chiave senza permesso a lungo termine vale per l'ora", JSON.stringify(soloChiave), JSON.stringify({ chiave: true, permesso: null }));
  const senzaTabella = await custodisciGoogle({ ...sessione, provider_token: "ya29.terza-chiave-lunga" }, { sb: supabaseFinto({ errore: { message: "relation does not exist" } }), st, accetta });
  t.eq("lo schema senza la tabella si dice (la chiave per l'ora resta)", `${senzaTabella.chiave} ${senzaTabella.permesso}`, "true non salvato");

  // ---- il rinnovo dal server --------------------------------------------------
  const chiamate = [];
  const server = (stato, corpo) => async (url, op) => (chiamate.push({ url, op }), { ok: stato === 200, status: stato, json: async () => corpo });
  const s2 = memoria();
  const conSessione = async () => ({ access_token: "jwt-1" });
  const buono = await rinnovoDalServer({ sessione: conSessione, fetch: server(200, { chiave: "ya29.nuova", scade: 5 }), st: s2 })();
  t.eq("una chiave nuova dal server", JSON.stringify(buono), JSON.stringify({ chiave: "ya29.nuova", scade: 5 }));
  t.c("…chiesta con la sessione, in POST", chiamate[0].url === "/api/google-token" && chiamate[0].op.method === "POST" && chiamate[0].op.headers.Authorization === "Bearer jwt-1");
  t.eq("…e si ricorda che il rinnovo funziona", statoRinnovo(s2), "ok");
  chiamate.length = 0;
  t.eq("senza sessione non si bussa", await rinnovoDalServer({ sessione: async () => null, fetch: server(200, {}), st: s2 })(), null);
  t.eq("…davvero", chiamate.length, 0);
  t.eq("un guasto del server non ferma i tentativi", (await rinnovoDalServer({ sessione: conSessione, fetch: server(502, { motivo: "google" }), st: s2 })(), statoRinnovo(s2)), "ok");
  for (const motivo of ["nessuno", "revocato"]) {
    const s3 = memoria();
    chiamate.length = 0;
    const f = rinnovoDalServer({ sessione: conSessione, fetch: server(motivo === "nessuno" ? 404 : 401, { motivo }), st: s3 });
    t.eq(`«${motivo}»: niente chiave`, await f(), null);
    await f();
    t.eq(`«${motivo}»: e non si bussa piu' fino al prossimo ingresso con Google`, chiamate.length, 1);
  }

  // ---- Drive negato nel consenso: si rientra con Google -----------------------
  let entrate = 0;
  const entra = async () => {
    entrate += 1;
  };
  const conGoogle = async () => ({ user: { app_metadata: { providers: ["email", "google"] } } });
  t.eq("entrato con Google: «Ricollega» rimanda da Google", await rientroConGoogle({ sessione: conGoogle, entra })(), true);
  t.eq("…davvero", entrate, 1);
  t.eq("entrato con l'email: niente rimando, c'è la finestra di Drive", await rientroConGoogle({ sessione: async () => ({ user: { app_metadata: { providers: ["email"] } } }), entra })(), false);
  t.eq("senza sessione: niente rimando", await rientroConGoogle({ sessione: async () => null, entra })(), false);
  t.eq("…e nessuno è andato da Google", entrate, 1);

  // ---- uscire -----------------------------------------------------------------
  const s4 = memoria();
  s4.setItem("bc_google_rinnovo", "ok");
  s4.setItem("bc_google_vista", "x");
  let impostato = "prima";
  lasciaGoogleQui({ st: s4, imposta: (f) => (impostato = f) });
  t.c("uscendo, questo dispositivo smette di rinnovare", impostato === null && statoRinnovo(s4) === "" && s4.getItem("bc_google_vista") === null);
  t.c("…e il permesso resta nel Supabase: serve all'altro dispositivo", sb.cancellate.length === 0);

  // ---- il rinnovo dentro drive.js ------------------------------------------
  const vecchi = { localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  globalThis.localStorage = memoria();
  const drive = await import("../src/lib/drive.js");
  try {
    globalThis.localStorage.setItem("bc_drive_on", "1");
    globalThis.localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "vecchia", scade: Date.now() - 1 }));
    let rinnovi = 0;
    let prossima = "k1";
    drive.impostaRinnovo(async () => {
      rinnovi += 1;
      await new Promise((r) => setTimeout(r, 5));
      return { chiave: prossima, scade: Date.now() + 3_600_000 };
    });
    const usate = [];
    let rifiuta = 0;
    globalThis.fetch = async (url, op = {}) => {
      const k = op.headers?.Authorization;
      usate.push(k);
      if (rifiuta > 0) {
        rifiuta -= 1;
        return { ok: false, status: 401, headers: { get: () => null }, json: async () => ({}) };
      }
      return { ok: true, status: 200, headers: { get: () => null }, blob: async () => new Blob(["x"]), json: async () => ({}) };
    };
    t.c("la chiave scaduta si sa scaduta", drive.chiaveInScadenza() && !drive.driveProntoOra());
    const [a, b] = await Promise.all([drive.rinnovaInSilenzio(), drive.rinnovaInSilenzio()]);
    t.c("chiesto in due, il server risponde una volta", a && b && rinnovi === 1);
    t.c("…e la chiave e' buona", drive.driveProntoOra() && !drive.chiaveInScadenza());

    globalThis.localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "vecchia", scade: Date.now() - 1 }));
    drive.impostaRinnovo(async () => ((rinnovi += 1), { chiave: prossima, scade: Date.now() + 3_600_000 }));
    // (la chiave in memoria del modulo e' quella buona: si dimentica come fa un 401)
    rifiuta = 1;
    prossima = "k2";
    usate.length = 0;
    await drive.scaricaDaDrive("f1");
    t.eq("una chiave ritirata a meta' lavoro: nuova chiave, e si riprova", usate.join(), "Bearer k1,Bearer k2");
    rifiuta = 2;
    let caduto = null;
    await drive.scaricaDaDrive("f1").catch((e) => (caduto = e));
    t.eq("…una volta sola: poi e' davvero scollegato", caduto?.name, "DriveScollegato");

    globalThis.localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "vecchia", scade: Date.now() - 1 }));
    await drive.scollegaDrive().catch(() => {});
    globalThis.localStorage.setItem("bc_drive_on", "1");
    prossima = "k3";
    drive.impostaRinnovo(async () => ({ chiave: prossima, scade: Date.now() + 3_600_000 }));
    rifiuta = 0;
    usate.length = 0;
    await drive.scaricaDaDrive("f1");
    t.eq("la chiave scaduta si rinnova PRIMA di chiedere, senza un rifiuto in mezzo", usate.join(), "Bearer k3");
    globalThis.localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "vecchia", scade: Date.now() - 1 }));
    await drive.scollegaDrive().catch(() => {});
    drive.impostaRinnovo(async () => ({}));
    t.c("un server che risponde senza chiave non e' un rinnovo", !(await drive.rinnovaInSilenzio()) && !drive.driveProntoOra());
    drive.impostaRinnovo(async () => ({ chiave: prossima, scade: Date.now() + 3_600_000 }));
    t.eq("chi ha il rinnovo non vede la finestra di Google", await drive.collegaDrive(), true);
    await drive.scollegaDrive();
    rinnovi = 0;
    t.c("scollegato vuol dire scollegato: niente chiavi dal server", !(await drive.rinnovaInSilenzio()) && rinnovi === 0);
  } finally {
    for (const [k, v] of Object.entries(vecchi)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
};
