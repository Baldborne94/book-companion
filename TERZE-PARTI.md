# Componenti di terze parti

Book Companion è proprietario (vedi `LICENSE`), ma non è scritto tutto qui
dentro: nel pacchetto che arriva sul dispositivo finiscono anche librerie
altrui. **Le loro licenze non sono un dettaglio burocratico: due di loro
chiedono espressamente che il testo della licenza e l'attribuzione
viaggino insieme al software** — Apache-2.0 all'articolo 4, BSD-2-Clause
alla prima clausola. Un'app pubblicata senza queste righe è un'app che
viola la licenza delle librerie su cui è costruita.

Questo file è quell'attribuzione. Va tenuto aggiornato quando si aggiunge
o si cambia una dipendenza di produzione (`dependencies` in
`package.json`), non quando si tocca un attrezzo di sviluppo: **gli
attrezzi restano sulla macchina di chi scrive, le dipendenze di produzione
partono col pacchetto**, e solo queste vanno dichiarate.

## Le dipendenze dirette

| Componente | Versione | Licenza | A cosa serve |
| --- | --- | --- | --- |
| [React](https://react.dev) e React DOM | 18.3 | MIT | l'interfaccia |
| [epub.js](https://github.com/futurepress/epub.js) | 0.3.93 | BSD-2-Clause | il reader EPUB |
| [pdf.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) | 6.3 | Apache-2.0 | il reader PDF |
| [JSZip](https://stuk.github.io/jszip/) | 3.10 | MIT o GPL-3.0-or-later — **qui si usa alla MIT** | l'archivio della biblioteca, e l'ePub ricucito |
| [supabase-js](https://github.com/supabase/supabase-js) | 2.111 | MIT | la sincronizzazione, quando è accesa |

## Le dipendenze indirette

Arrivano con quelle sopra e finiscono anch'esse nel pacchetto. Tutte
permissive: MIT, ISC, 0BSD, Apache-2.0, Zlib.

`@supabase/auth-js`, `@supabase/functions-js`, `@supabase/phoenix`,
`@supabase/postgrest-js`, `@supabase/realtime-js`, `@supabase/storage-js`,
`@xmldom/xmldom`, `core-js`, `core-util-is`, `d`, `es5-ext`, `es6-iterator`,
`es6-symbol`, `esniff`, `event-emitter`, `ext`, `immediate`, `inherits`,
`isarray`, `js-tokens`, `lie`, `localforage` (Apache-2.0), `lodash`,
`loose-envify`, `marks-pane`, `next-tick`, `pako` (MIT e Zlib),
`path-webpack`, `process-nextick-args`, `readable-stream`, `safe-buffer`,
`scheduler`, `setimmediate`, `string_decoder`, `tslib` (0BSD),
`type`, `util-deprecate`.

**Nessuna licenza copyleft**, ed è una cosa da ricontrollare a ogni
aggiunta: una singola dipendenza GPL renderebbe impubblicabile l'app
come software proprietario. JSZip è l'unico caso doppio — MIT *oppure*
GPL-3.0-or-later, a scelta di chi la usa — e qui si sceglie la MIT.

Per rifare l'elenco da capo:

```sh
npm ls --prod --parseable --all | sed 's|.*/node_modules/||' | sort -u
```

## I testi delle licenze

Non sono ricopiati qui: stanno per intero dentro `node_modules/<pacchetto>/`
in ogni copia del progetto, e vengono raccolti nel pacchetto distribuito.
I due che vanno mostrati a chi usa l'app sono:

- **Apache License 2.0** — https://www.apache.org/licenses/LICENSE-2.0
  (pdf.js, Copyright Mozilla Foundation; localforage, Copyright Mozilla)
- **BSD 2-Clause** — https://opensource.org/licenses/BSD-2-Clause
  (epub.js, Copyright Fred Chasen)

## I caratteri

L'app carica **EB Garamond** e **Cormorant Garamond** da Google Fonts,
tutt'e due sotto [SIL Open Font License 1.1](https://openfontlicense.org):
si possono incorporare e ridistribuire liberamente. La OFL non chiede di
mostrare nulla a chi legge, ma chiede di non venderli da soli e di non
usarne il nome per una versione modificata — e qui non si fa né l'uno né
l'altro, si caricano e basta.
