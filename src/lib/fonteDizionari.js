// DA DOVE SCENDONO I DIZIONARI OFFLINE (WordNet e Wiktionary).
//
// Chiesto dal lettore dopo l'email di Vercel sui 10 GB pieni («togli il
// dizionario dalle build»): ogni deployment portava con se' 32 MB di
// dizionari (28 di Wiktionary, 4 di WordNet) su 36, e ne restavano copie a
// centinaia. I file stanno nel repository (`dizionario/`, fuori da `public/`:
// Vite non li copia), e si scaricano dal ramo `main` cosi' come GitHub li
// serve a un browser (`access-control-allow-origin: *`, il `.gz` com'e',
// senza `Content-Encoding`: lo apre `wiktionaryOffline.js`). Si scaricano
// una volta sola, dal tasto delle Impostazioni, e poi stanno nell'app.
export const DIZIONARI = "https://raw.githubusercontent.com/Baldborne94/book-companion/main/dizionario";
