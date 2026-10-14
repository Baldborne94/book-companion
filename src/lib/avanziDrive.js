// QUEL CHE GOOGLE DRIVE HA LASCIATO SUI DISPOSITIVI (chiesto dal lettore,
// lasciato Drive: «pulizia su cose che non servono piu'»). Le chiavi di
// Drive, la mappa dei libri e delle melodie, l'elenco dei file tenuto in
// IndexedDB, e nel Supabase la riga col permesso a lungo termine di Google
// (`google_refresh`), che con Drive dentro apriva i file del lettore. Si
// toglie tutto da solo, a ogni avvio finche' c'e' qualcosa: togliere quel
// che non c'e' non costa niente.

export const CHIAVI_DRIVE = [
  "bc_drive_token",
  "bc_drive_on",
  "bc_drive_client",
  "bc_drive_api_key",
  "bc_drive_libri",
  "bc_drive_melodie",
  "bc_drive_permesso",
  "bc_drive_mai",
  "bc_drive_archivio",
  "bc_google_rinnovo",
  "bc_google_vista",
];
export const AUX_DRIVE = ["drive_elenco"];
// la riga del Supabase si toglie una volta per account e dispositivo
const RIGA_KEY = "bc_google_riga_tolta";

export async function togliAvanziDrive({ st = globalThis.localStorage, togliAux = null, sb = null, uid = null } = {}) {
  const tolte = [];
  for (const k of CHIAVI_DRIVE) {
    try {
      if (st.getItem(k) != null) {
        st.removeItem(k);
        tolte.push(k);
      }
    } catch {
      /* storage che non risponde: si riprova al prossimo avvio */
    }
  }
  if (togliAux) for (const k of AUX_DRIVE) await togliAux(k).catch(() => {});
  let riga = false;
  if (sb && uid && st.getItem?.(RIGA_KEY) !== uid) {
    // la tabella puo' non esserci piu' (tolta dallo schema): nessun guasto
    let error = null;
    try {
      ({ error } = (await sb.from("google_refresh").delete().eq("user_id", uid)) || {});
    } catch (e) {
      error = e;
    }
    if (!error || /google_refresh|does not exist|42P01|PGRST20/.test(String(error.message || error.code || ""))) {
      try {
        st.setItem(RIGA_KEY, uid);
      } catch {
        /* si riprova */
      }
      riga = true;
    }
  }
  return { tolte, riga };
}
