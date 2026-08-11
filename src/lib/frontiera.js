// LA FRONTIERA DI QUELLO CHE HAI LETTO.
//
// Una scheda su un personaggio non deve mai dirti una riga che non hai
// ancora letto — e «letto» in una saga non e' «fin dove sono in questo
// volume». Se sei al terzo, quel personaggio l'hai incontrato nel primo,
// nel secondo e in un pezzo del terzo: la scheda va cucita su quello, e
// deve ignorare il quarto anche se ce l'hai sullo scaffale.
//
// La regola, in ordine di lettura della saga:
//   volume PRIMA del corrente, finito      → tutto
//   volume PRIMA del corrente, in lettura  → fino al suo segnalibro
//   volume PRIMA del corrente, mai aperto  → niente (l'hai saltato)
//   volume CORRENTE                        → fino al tuo segnalibro
//   volume DOPO il corrente                → niente, mai, in nessun caso
//
// I volumi dopo restano fuori anche se li hai gia' letti. Sembra una
// perdita ed e' una scelta: se stai rileggendo il terzo di una saga che
// conosci a memoria, una scheda che ti ricorda cosa succede nel quinto ti
// rovina la rilettura. Sbagliare per prudenza qui non costa quasi niente;
// sbagliare per generosita' costa un libro.
//
// Senza numero d'ordine un volume non si sa collocare: resta fuori. Meglio
// una scheda piu' povera di una che tradisce.

export function frontiera(corrente, libri, { statusOf, cfiOf }) {
  if (!corrente) return [];
  const suo = cfiOf(corrente.id) || null;
  const qui = suo ? [{ libro: corrente, tutto: false, fino: suo }] : [];

  const saga = (corrente.saga || "").trim();
  const ordine = corrente.sagaOrder;
  if (!saga || ordine == null) return qui;

  const prima = [];
  for (const b of libri) {
    if (b.id === corrente.id) continue;
    if ((b.saga || "").trim() !== saga) continue;
    if (b.sagaOrder == null || b.sagaOrder >= ordine) continue;
    const stato = statusOf(b.id);
    if (stato === "read") prima.push({ libro: b, tutto: true, fino: null });
    else if (stato === "reading") {
      const c = cfiOf(b.id);
      if (c) prima.push({ libro: b, tutto: false, fino: c });
    }
  }
  prima.sort((a, b) => a.libro.sagaOrder - b.libro.sagaOrder);
  return [...prima, ...qui];
}

// Come si racconta al lettore da dove viene la risposta. Non e' un dettaglio
// tecnico: e' quello che gli permette di CONTROLLARE invece di fidarsi.
export function raccontaFrontiera(tappe) {
  if (!tappe.length) return "non hai ancora letto abbastanza";
  return tappe
    .map((t) => (t.tutto ? `«${t.libro.title}» per intero` : `«${t.libro.title}» fino al tuo segno`))
    .join(", ");
}
