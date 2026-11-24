// ELIMINARE UNA RACCOLTA (chiesto dal lettore, con la foto dei manga e due
// raccolte «JoJo's Bizarre Adventure» una accanto all'altra: «mi permetti di
// cancellare direttamente una raccolta?»). Due cose diverse, e si sceglie:
//
// - SCIOGLIERLA: i volumi restano, senza raccolta. La saga si toglie come la
//   toglie la mano nella scheda (`sagaTolta`: il giro automatico non ce li
//   rimette, e una saga vuota senza quel segno non cancella la saga
//   sull'altro dispositivo, `riempiSaga`), e con lei la serie e il numero,
//   che senza la saga non dicono niente. Solo per una saga: una raccolta
//   d'autore e' fatta dall'autore, che non si toglie.
// - ELIMINARE I VOLUMI: le schede e i loro file, come «Elimina» nella scheda
//   (la lapide arriva sull'altro dispositivo). Prima si dice quanti sono e
//   quanti file se ne vanno da qui.

export const puoEssereSciolta = (r) => r?.tipo === "saga";

// i libri di una raccolta, e quanti hanno il file qui
export function contoDaEliminare(r, qui = null) {
  const ids = (r?.libri || []).map((b) => b.id);
  return { ids, conFile: qui ? ids.filter((id) => qui.has(id)).length : 0 };
}

// la biblioteca con quei libri senza raccolta (e solo quelli: gli altri
// restano lo stesso oggetto, cosi' chi scrive timbra solo chi e' cambiato)
export function sciogliRaccolta(libri = [], ids = []) {
  const via = new Set(ids);
  return libri.map((b) => (via.has(b.id) ? { ...b, saga: "", sagaTolta: true, series: "", sagaOrder: null } : b));
}

export function fraseEliminaRaccolta(nome, { ids = [], conFile = 0 } = {}) {
  const n = ids.length;
  const volumi = n === 1 ? "un volume" : `${n} volumi`;
  const file = conFile ? (conFile === 1 ? ", e il file di uno da questo dispositivo" : `, e il file di ${conFile} da questo dispositivo`) : "";
  return `Elimino ${volumi} di «${nome}»${file}? Le schede spariscono anche dall'altro dispositivo, e non si torna indietro.`;
}
