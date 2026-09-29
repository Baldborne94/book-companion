// UNA MODIFICA PARTE DA SOLA, POCO DOPO (segnalato: undici libri messi in
// saga a mano sul PC, e sul tablet ancora «Fuori saga»). La
// sincronizzazione partiva all'avvio, al ritorno della rete e quando la
// pagina tornava visibile: sul PC la finestra resta visibile per ore, e la
// saga scritta nella scheda restava li' finche' non si chiudeva l'app.
// Adesso chi cambia una scheda chiama `tira()`: il giro parte dopo
// `attesa`, una volta sola per una raffica di modifiche, e se trova un giro
// gia' in corso riprova dopo (quello in corso puo' aver letto la
// biblioteca prima della modifica).
export const PRESTO = 3000;

export function sincronizzaPresto(avvia, { attesa = PRESTO, occupato = () => false, orologio = globalThis } = {}) {
  let timer = null;
  const giro = () => {
    if (occupato()) {
      timer = orologio.setTimeout(giro, attesa);
      return;
    }
    timer = null;
    avvia();
  };
  const tira = () => {
    if (timer) orologio.clearTimeout(timer);
    timer = orologio.setTimeout(giro, attesa);
  };
  tira.ferma = () => {
    if (timer) orologio.clearTimeout(timer);
    timer = null;
  };
  return tira;
}
