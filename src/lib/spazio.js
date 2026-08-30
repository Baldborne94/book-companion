// QUANTO SPAZIO C'E', E QUALE DEI DUE CONTA.
//
// Gli spazi sono due e non hanno lo stesso peso nella vita di chi legge.
//
// (1) Quello LOCALE, che il browser stima con `navigator.storage.estimate`.
// La Libreria lo mostrava sempre e per intero — «152 MB usati di 499,6 GB» —
// e il lettore ha chiesto: «cosa sarebbero sti 500 GB?». Domanda giusta, e
// la risposta e' che quel numero non e' quasi mai un'informazione:
//   · non e' lo spazio del dispositivo, e' un tetto che il browser calcola
//     su quanto disco LIBERO c'e' adesso;
//   · non e' una promessa: si restringe da solo mentre riempi il tablet di
//     foto, e domani puo' dire tutt'altro senza che tu abbia fatto niente;
//   · non protegge da niente: a persistenza negata il browser puo' sfrattare
//     tutto restando larghissimo sotto la quota — ed e' proprio l'avviso che
//     sta due righe sopra, che cosi' si contraddiceva da solo.
// A 152 MB su 500 GB e' lo 0,03%: una percentuale che non dice niente a
// nessuno. Vale la regola che l'app applica gia' al promemoria
// dell'archivio: **sotto soglia si tace del tutto**, perche' un numero che
// non chiede niente si impara a ignorare, e allora non lo si legge piu'
// nemmeno il giorno che conta.
//
// (2) Quello nel CLOUD, che e' l'unico che ti vincola davvero: il piano
// gratuito da' un gigabyte, e ci stanno cinquanta romanzi ma poche decine di
// melodie. Quel numero esisteva gia' ma stava nel pannello della
// sincronizzazione, cioe' in un posto che si apre una volta al mese —
// mentre in Libreria, dove si guarda, c'era quello inutile. Il numero giusto
// nel posto sbagliato e quello sbagliato nel posto giusto.
//
// Qui stanno le due decisioni, senza JSX, perche' un test le possa chiamare.

// Il piano gratuito di Supabase. NON e' una misura: non si puo' chiedere al
// server, dipende dal piano. E' un RIFERIMENTO dichiarato — la barra dice
// «quanto ci sta in un piano gratuito» — e sta qui, in un posto solo, invece
// che scritto a mano dove serve: prima era il numero in `SyncPanel` piu' la
// stringa «di 1 GB» accanto, due cose da cambiare insieme e da dimenticare
// separatamente.
export const PIANO = 1e9;

// Oltre questa parte del piano si comincia a stare stretti, e la barra lo
// dice a parole invece di lasciartelo dedurre da una striscia colorata.
export const PIENO = 0.8;

// LE DUE SOGLIE DEL TETTO LOCALE, e sono due perche' misurano cose diverse.
// La frazione prende il caso «questa biblioteca e' grossa per questo
// dispositivo»; il resto in byte prende quello «questo dispositivo e' pieno,
// e la biblioteca non c'entra» — che e' il caso piu' frequente sul serio, e
// che una soglia in percentuale non vedrebbe mai su un tablet con mezzo tera
// di quota.
export const QUOTA_PARTE = 0.5;
export const QUOTA_RESTO = 2e9;

// Il tetto locale merita di essere detto? Solo se stringe: se no la riga
// dice quanto pesa la biblioteca e basta, che e' l'unica cosa che serve
// sapere quasi sempre.
export function stretto(estimate) {
  const usato = Number(estimate?.usage);
  const tetto = Number(estimate?.quota);
  // senza una delle due misure non c'e' niente da confrontare, e un tetto a
  // zero non e' un tetto stretto: e' un browser che non sa rispondere
  if (!Number.isFinite(usato) || !Number.isFinite(tetto) || tetto <= 0) return false;
  return usato / tetto >= QUOTA_PARTE || tetto - usato <= QUOTA_RESTO;
}

// Quanto della biblioteca sta lassu', come frazione del piano. Torna `null`
// quando non c'e' niente da dire — nessun conto, o un conto che non e' un
// numero — invece di uno zero, che sullo schermo sembra una misura.
export function parteDelPiano(totale) {
  const n = Number(totale);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / PIANO;
}

// La frazione da disegnare in una barra: non esce mai dal binario, o una
// biblioteca piu' grande del piano darebbe una striscia piu' lunga del suo
// contenitore.
export const fetta = (n) => `${Math.max(0, Math.min(1, (Number(n) || 0) / PIANO)) * 100}%`;

// DI COSA E' FATTO IL GIGABYTE, in tre pezzi: i libri, le melodie, e quel che
// resta. In Libreria si leggeva solo il totale, ed e' il numero giusto ma non
// risponde alla domanda del lettore — «quanto spazio ho ancora per caricare
// la mia musica» — perche' libri e melodie stanno nello STESSO secchio e un
// totale non dice quale dei due lo riempie.
//
// LE COPERTINE VANNO COI LIBRI, e non e' un dettaglio di stile: contate a
// parte, o dimenticate, i tre pezzi non tornerebbero piu' il piano e la barra
// avrebbe un buco che nessun errore segnala — si vedrebbe solo guardandola
// bene. Il test tiene proprio questo patto: la somma delle tre regioni fa il
// piano esatto.
//
// Sta qui e non nel componente per la ragione di sempre: senza JSX un test la
// puo' chiamare.
export function spartisci(dati) {
  if (!dati) return null;
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const libri = n(dati.libri?.byte) + n(dati.copertine?.byte);
  const melodie = n(dati.melodie?.byte);
  const totale = n(dati.totale);
  return {
    libri,
    melodie,
    // il resto si prende dal TOTALE e non dalla somma dei due: il totale e'
    // quel che il secchio pesa davvero, e se un giorno ci finisse dentro una
    // terza specie di file la barra direbbe meno spazio libero — che e' la
    // bugia giusta da dire, perche' quello spazio davvero non c'e' piu'
    liberi: Math.max(0, PIANO - totale),
    sforato: Math.max(0, totale - PIANO),
  };
}
