// QUEL CHE GOOGLE DRIVE HA LASCIATO (chiesto dal lettore, lasciato Drive:
// «pulizia su cose che non servono piu'»): le chiavi sul dispositivo,
// l'elenco dei file in IndexedDB e, nel Supabase, la riga col permesso a
// lungo termine di Google, che con Drive dentro apriva i file del lettore.
// E «Entra con Google» non chiede piu' Drive.
import { togliAvanziDrive, CHIAVI_DRIVE, AUX_DRIVE } from "../src/lib/avanziDrive.js";
import { entraConGoogle } from "../src/lib/accessoGoogle.js";

function memoria(iniziale = {}) {
  const m = { ...iniziale };
  return {
    m,
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => (m[k] = String(v)),
    removeItem: (k) => delete m[k],
  };
}

function supabaseFinto({ errore = null, esplode = false } = {}) {
  const tolte = [];
  let oauth = null;
  return {
    tolte,
    oauth: () => oauth,
    auth: { signInWithOAuth: async (o) => ((oauth = o), { error: null }) },
    from: (tabella) => ({
      delete: () => ({
        eq: async (k, v) => {
          if (esplode) throw new Error("rete");
          tolte.push(`${tabella}:${k}=${v}`);
          return { error: errore };
        },
      }),
    }),
  };
}

export default async (t) => {
  // ---- sul dispositivo -----------------------------------------------------
  const st = memoria({ bc_drive_token: "ya29", bc_drive_libri: "{}", bc_drive_mai: "1", bc_google_vista: "x", bc_books: "[]", bc_tema: "notte" });
  const aux = [];
  const e = await togliAvanziDrive({ st, togliAux: async (k) => aux.push(k) });
  t.eq("via le chiavi di Drive e di Google", e.tolte.sort().join(), "bc_drive_libri,bc_drive_mai,bc_drive_token,bc_google_vista");
  t.eq("il resto della biblioteca non si tocca", Object.keys(st.m).sort().join(), "bc_books,bc_tema");
  t.eq("e l'elenco dei file di Drive in IndexedDB", aux.join(), "drive_elenco");
  t.c("ogni chiave dei tempi di Drive e' nell'elenco", ["bc_drive_on", "bc_drive_client", "bc_drive_api_key", "bc_drive_melodie", "bc_drive_permesso", "bc_drive_archivio", "bc_google_rinnovo", "bc_anticipo"].every((k) => CHIAVI_DRIVE.includes(k)) && AUX_DRIVE.includes("drive_elenco"));
  t.eq("rifatto, non c'e' piu' niente da togliere", (await togliAvanziDrive({ st })).tolte.length, 0);

  // ---- nel Supabase ----------------------------------------------------------
  const sb = supabaseFinto();
  const st2 = memoria();
  const primo = await togliAvanziDrive({ st: st2, sb, uid: "u1" });
  t.c("la riga dell'utente col permesso di Google se ne va", primo.riga && sb.tolte.join() === "google_refresh:user_id=u1");
  await togliAvanziDrive({ st: st2, sb, uid: "u1" });
  t.eq("una volta sola per account e dispositivo", sb.tolte.length, 1);
  await togliAvanziDrive({ st: st2, sb, uid: "u2" });
  t.eq("un altro account la sua", sb.tolte.at(-1), "google_refresh:user_id=u2");
  t.eq("senza account niente", (await togliAvanziDrive({ st: memoria(), sb })).riga, false);
  t.c("…nemmeno dopo aver pulito un altro account", !(await togliAvanziDrive({ st: st2, sb })).riga && sb.tolte.length === 2);

  const senzaTabella = supabaseFinto({ errore: { code: "42P01", message: 'relation "public.google_refresh" does not exist' } });
  const st3 = memoria();
  t.c("una tabella che non c'e' piu' e' gia' pulita", (await togliAvanziDrive({ st: st3, sb: senzaTabella, uid: "u1" })).riga);
  const giu = supabaseFinto({ esplode: true });
  const st4 = memoria();
  t.eq("la rete giu': si riprova al giro dopo", (await togliAvanziDrive({ st: st4, sb: giu, uid: "u1" })).riga, false);
  const rifiuto = supabaseFinto({ errore: { code: "42501", message: "permission denied" } });
  t.eq("un rifiuto vero: si riprova", (await togliAvanziDrive({ st: memoria(), sb: rifiuto, uid: "u1" })).riga, false);

  // ---- entrare con Google ----------------------------------------------------
  const og = supabaseFinto();
  await entraConGoogle({ sb: og, origine: "https://book.example" });
  const o = og.oauth();
  t.eq("da Google, e di ritorno qui", `${o.provider} ${o.options.redirectTo}`, "google https://book.example");
  t.c("senza il permesso per Drive, ne' uno a lungo termine", !o.options.scopes && !o.options.queryParams);
};
