import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import TastoBarra, { barBtn, useNomiNeiTasti, useDueRighe, BarraDelLibro, MusicaInBarra } from "./TastoBarra.jsx";
import { fileDaLeggere, convertiLibroInCbz } from "../lib/sync.js";
import { driveProntoOra, mappaDrive } from "../lib/drive.js";
import { fraseDiscesa, fraseCarico } from "../lib/driveCore.js";
import RicollegaDrive from "./RicollegaDrive.jsx";
import { getCfi, setCfi, getMarks, saveMarks } from "../lib/annotations.js";
import { setProgress, setStatus } from "../lib/library.js";
import { vocePerVoltata, segnaVoltata } from "../lib/voltate.js";
import { loadReaderSettings, saveReaderSettings } from "../lib/readerSettings.js";
import { apriFumetto, misuraBordi } from "../lib/archivioFumetto.js";
import {
  paginaDaAprire,
  tocco,
  leggiVerso,
  scriviVerso,
  leggiAdatta,
  scriviAdatta,
  tipoImmagine,
  bordiDaMisure,
  disegnaPagina,
  leggiBordi,
  scriviBordi,
  eLarga,
  coppiaDi,
  coppiaVicina,
  leggiDoppia,
  scriviDoppia,
  doppiaAccesa,
  orientamento,
  leggiLarghe,
  scriviLarghe,
  leggiSposta,
  scriviSposta,
  disegnaCoppia,
  altezzeNastro,
  cimeNastro,
  paginaAlPunto,
  pagineAvanti,
  daPreparare,
  daLasciare,
  PERCHE_CBR_GRANDE,
  fraseConversione,
  sfumaDa,
  SFUMA_MS,
  daDecodificare,
  fogliInScena,
} from "../lib/fumetto.js";
import { vuoto } from "../lib/pdfCrop.js";
import { conAttesa } from "../lib/misuraPagine.js";
import { doppioTocco, limita, zoomAttorno } from "../lib/tavola.js";
import { apertaATuttoSchermo, serveTastoSchermo } from "../lib/schermoIntero.js";
import BookCover from "./BookCover.jsx";

// IL LETTORE DEI FUMETTI (CBZ e CBR): una pagina e' un'immagine, e il
// lavoro e' tutto nel gesto — voltare, avvicinarsi, e il VERSO, perche' un
// manga si legge da destra. Le decisioni che sbagliano in silenzio (quale
// formato, l'ordine delle pagine, cosa fa un tocco a sinistra in un manga)
// stanno in `lib/fumetto.js`; lo zoom e' quello della tavola
// (`lib/tavola.js`), che il gesto lo conosce gia'.
//
// LE PAGINE SI ESTRAGGONO UNA PER VOLTA e si tengono come object URL per
// quella aperta e le sue vicine, revocando le altre: un volume da trecento
// pagine decodificato tutto insieme e' il modo piu' rapido di farsi
// chiudere la scheda su un tablet (lezione 11: i byte si persistono, gli
// object URL no — qui vivono quanto la lettura).

const isTouch = () => navigator.maxTouchPoints > 0;
const MOSSA = 12;
const PRESSIONE = 500;
const DOPPIO = 300;
const SCORSA = 60;
// quante pagine tenere pronte attorno a quella aperta: in doppia pagina la
// coppia dopo e quella prima sono quattro
const VICINE = 4;
// una pagina che non si e' lasciata leggere si richiede una volta, dopo un
// respiro: su Drive un intoppo della rete passa quasi sempre in un attimo
const RIPROVA = 600;
// quanto si aspetta la misura dei bordi prima di mostrare la prima pagina
const MISURA_MAX = 4000;
// IL NASTRO NON E' PIU' LARGO DI COSI': sul tablet (1280) e' lo schermo
// intero, su un monitor largo una pagina da due metri d'altezza non si
// legge meglio, si scorre di piu'
const NASTRO_MAX = 1280;
// le pagine del nastro con l'immagine dentro, attorno a quella che guardi:
// piu' avanti che indietro, perche' si scorre in avanti
const NASTRO_DIETRO = 2;
const NASTRO_AVANTI = 4;
// quante pagine avanti si chiedono insieme (vedi `preparaAvanti`)
const IN_VOLO = 3;

function Panel({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 30, background: "#00000066", display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(92%, ${px(360)}px)`,
          height: "100%",
          overflowY: "auto",
          padding: "14px 16px calc(14px + env(safe-area-inset-bottom))",
          background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: "-10px 0 40px #00000088",
          animation: "bc-fade-in 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: FONT_TITLE, fontSize: F.rilievo, fontWeight: 600, color: C.text }}>{title}</span>
          <button onClick={onClose} style={barBtn(false)} aria-label="Chiudi il pannello">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// «meno animazioni» del sistema vale anche qui, come nel reader dei libri
function riduciMovimento() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function ComicReader({ book, startCfi, music, onMusicToggle, onMusicStop, onMusicVolume, onMusicNext, onMusicRoom, onAlive, onClose, notify, nextBook, onReadNext, indietro, onCambiaLibro }) {
  const rootRef = useRef(null);
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const archivio = useRef(null);
  const urls = useRef(new Map());
  const pesi = useRef(new Map());
  // (urlDi chiama `preDecodifica`, che sta piu' sotto)
  const preDecodificaRef = useRef(() => {});
  const inArrivo = useRef(new Map());
  const gettone = useRef(0);
  const live = useRef({ page: 1, pages: 0 });
  const st = useRef({ s: 1, x: 0, y: 0 });
  const dita = useRef(new Map());
  const pizzico = useRef(null);
  const partenza = useRef(null);
  const ultimoTocco = useRef(null);
  const attesaBarre = useRef(null);
  const primoGiro = useRef(true);

  const [settings, setSettings] = useState(() => loadReaderSettings(Math.min(window.innerWidth, window.innerHeight)));
  const [status, setStatusUi] = useState("loading");
  const [discesa, setDiscesa] = useState("");
  const [perche, setPerche] = useState("");
  const [apertura, setApertura] = useState(0);
  const [chrome, setChrome] = useState(() => !isTouch());
  const [panel, setPanel] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  // le pagine a schermo, una o due, ognuna col suo object URL
  const [srcs, setSrcs] = useState([]);
  // per quale coppia sono quelle pagine: una coppia a cui ne manca una (non
  // si e' lasciata leggere) si disegna con quella che c'e'
  const [srcsDi, setSrcsDi] = useState("");
  // la voltata che sfuma: l'ultimo foglio disegnato, e le sue pagine che
  // svaniscono sopra il nuovo (`uscente`)
  const disegnato = useRef(null);
  const contaSfuma = useRef(0);
  const misuraVoltata = useRef(null);
  const [uscente, setUscente] = useState(null);
  const [verso, setVerso] = useState(() => leggiVerso(book.id, book.verso));
  const [adatta, setAdatta] = useState(() => leggiAdatta());
  // I BORDI DELLA SCANSIONE (`lib/fumetto.js`): misurati una volta per
  // libro alla prima apertura, sotto la candela, e poi letti dal
  // dispositivo. `null` = non ancora misurati.
  const [bordi, setBordi] = useState(() => leggiBordi(book.id));
  // la misura del file aperto e quella del riquadro: il disegno della
  // pagina (`disegnaPagina`) e' aritmetica su questi due
  // la misura di ogni file aperto (per pagina): serve al disegno e dice
  // quali tavole sono larghe
  const natRef = useRef(new Map());
  const [nats, setNats] = useState({});
  // la scelta si rilegge a ogni disegno per l'orientamento di adesso
  const [, setSceltaDoppia] = useState(0);
  const [larghe, setLarghe] = useState(() => leggiLarghe(book.id));
  const [sposta, setSposta] = useState(() => leggiSposta(book.id));
  const [riquadro, setRiquadro] = useState(null);
  const [isFs, setIsFs] = useState(false);
  const [marks, setMarks] = useState(() => getMarks(book.id));
  const [endCard, setEndCard] = useState(null);
  const [jump, setJump] = useState("");
  const nomiNeiTasti = useNomiNeiTasti();
  const dueRighe = useDueRighe();
  // quanto e' alta la barra in cima: il pannello della luce le sta sotto
  const [altezzaBarra, setAltezzaBarra] = useState(0);
  // un fumetto grosso che sta su Drive si legge da li' a pagine (vedi
  // `fileDaLeggere`): una pagina che non arriva a chiave scaduta chiede un
  // tocco, e `riprova` la richiede quando la chiave e' tornata
  const lontano = useRef(false);
  const [senzaChiave, setSenzaChiave] = useState(false);
  const [riprova, setRiprova] = useState(0);

  const intera = adatta === "intera";
  const nastro = adatta === "nastro";
  // LA DOPPIA PAGINA (vedi `coppie` in lib/fumetto.js) vale solo a pagina
  // intera: nel nastro le pagine stanno una sotto l'altra
  const doppia = intera && pages > 1 && doppiaAccesa(leggiDoppia(orientamento(riquadro)), riquadro);
  const opzioni = { larghe, sposta };
  const mostrate = doppia ? coppiaDi(page, pages, opzioni) : [page];
  const chiaveMostrate = mostrate.join(",");
  live.current.doppia = doppia;
  live.current.opzioni = opzioni;
  live.current.nastro = nastro;
  live.current.intera = intera;
  live.current.sfuma = settings.sfumaFumetti !== false && !riduciMovimento();

  // le pagine del nastro che hanno l'immagine (n → object URL)
  const [vista, setVista] = useState({});

  const flush = useCallback(() => {
    const s = live.current;
    if (s.pages > 0) {
      setCfi(book.id, String(s.page));
      // in doppia pagina hai davanti anche la seconda: il progresso e' fin li'
      setProgress(book.id, (s.ultima || s.page) / s.pages);
    }
  }, [book.id]);

  const handleClose = useCallback(() => {
    flush();
    if (live.current.pages > 0 && (live.current.ultima || live.current.page) / live.current.pages >= 0.97) setStatus(book.id, "read");
    onClose();
  }, [book.id, flush, onClose]);

  const goToPage = useCallback((n) => {
    const max = live.current.pages || 1;
    setPage(Math.min(max, Math.max(1, n)));
  }, []);

  // avanti e indietro nel senso della LETTURA, non dello schermo; in doppia
  // pagina di una coppia per volta
  // nel nastro «avanti» e' uno schermo piu' giu' (un tocco al bordo, una
  // freccia): la pagina segue lo scorrimento
  const scorri = (dir) => {
    const b = boxRef.current;
    if (b) b.scrollBy({ top: dir * b.clientHeight * 0.9, behavior: "smooth" });
  };
  const avanti = useCallback(() => {
    const l = live.current;
    if (l.nastro) return scorri(1);
    if (!l.doppia) return goToPage(l.page + 1);
    const n = coppiaVicina(l.page, l.pages, l.opzioni, 1);
    if (n) goToPage(n);
  }, [goToPage]);
  const indietroDiUna = useCallback(() => {
    const l = live.current;
    if (l.nastro) return scorri(-1);
    if (!l.doppia) return goToPage(l.page - 1);
    const n = coppiaVicina(l.page, l.pages, l.opzioni, -1);
    if (n) goToPage(n);
  }, [goToPage]);

  // l'object URL di una pagina, estratta se non e' gia' pronta
  const urlDi = useCallback(async (n) => {
    const a = archivio.current;
    if (!a || n < 1 || n > a.pagine.length) return null;
    if (urls.current.has(n)) return urls.current.get(n);
    if (!inArrivo.current.has(n)) {
      inArrivo.current.set(
        n,
        (async () => {
          const bytes = await a.leggi(n - 1);
          const blob = new Blob([bytes], { type: tipoImmagine(a.pagine[n - 1]) || "image/jpeg" });
          const url = URL.createObjectURL(blob);
          urls.current.set(n, url);
          pesi.current.set(n, blob.size);
          inArrivo.current.delete(n);
          preDecodificaRef.current();
          return url;
        })().catch((e) => {
          inArrivo.current.delete(n);
          throw e;
        })
      );
    }
    return inArrivo.current.get(n);
  }, []);

  // I FOGLI DOPO E PRIMA GIA' DISEGNATI (`daDecodificare`): le loro <img> stanno
  // sotto la pagina a schermo, nella STESSA lista con la stessa chiave (il
  // numero di pagina), all'1%. Alla voltata React tiene lo stesso elemento e
  // Chrome lo trova decodificato; un <img> nuovo con lo stesso indirizzo si
  // rilegge e si ridecodifica da capo (misurato: `decode()` fuori dallo
  // schermo, o un velo a parte, 86 ms contro 87).
  const [prossimo, setProssimo] = useState([]);
  // ogni foglio entra solo intero (una coppia a meta' si disegnerebbe male)
  const preDecodifica = useCallback(() => {
    const l = live.current;
    const { avanti, indietro } = daDecodificare({ ultima: l.ultima, prima: l.prima, pages: l.pages, doppia: l.doppia, opzioni: l.opzioni });
    const foglio = (pagine, k) => {
      const pronti = pagine.map((n, indice) => ({ n, url: urls.current.get(n), foglio: k, indice }));
      return pronti.every((x) => x.url) ? pronti : [];
    };
    const voluti = [...foglio(avanti, 0), ...foglio(indietro, 1)];
    const firma = (l2) => l2.map((x) => `${x.foglio}:${x.indice}:${x.url}`).join();
    setProssimo((p) => (firma(p) === firma(voluti) ? p : voluti));
  }, []);

  preDecodificaRef.current = preDecodifica;

  // le pagine lontane si lasciano andare solo oltre il tetto di byte
  // (`daLasciare`): da Drive riprenderle e' un viaggio in rete. La finestra
  // tiene sempre le pagine preparate avanti (`pagineAvanti`): sfoltite
  // appena preparate, il lavoro sarebbe buttato
  const sfoltisci = useCallback((attorno) => {
    const avanti = Math.max(VICINE, (live.current.avanti || 0) + 2);
    const pronte = [...urls.current.keys()].map((n) => [n, pesi.current.get(n) || 0]);
    for (const n of daLasciare(pronte, { attorno, dietro: VICINE, avanti })) {
      URL.revokeObjectURL(urls.current.get(n));
      urls.current.delete(n);
      pesi.current.delete(n);
    }
  }, []);

  // la misura di un file: la da' il <img> a schermo (`onLoad`) o una
  // decodifica fuori schermo per le vicine. Una tavola larga si ricorda
  // per il libro: e' quella che cambia le coppie.
  const segnaMisura = useCallback((n, m) => {
    if (!(m?.w > 0 && m?.h > 0) || natRef.current.has(n)) return;
    natRef.current.set(n, m);
    setNats((v) => ({ ...v, [n]: m }));
    if (eLarga(m)) {
      setLarghe((prima) => {
        if (prima.has(n)) return prima;
        const dopo = new Set(prima);
        dopo.add(n);
        scriviLarghe(book.id, dopo);
        return dopo;
      });
    }
  }, [book.id]);

  const misuraDi = useCallback(async (n) => {
    if (natRef.current.has(n)) return;
    const url = await urlDi(n);
    if (!url) return;
    const im = new Image();
    im.src = url;
    await im.decode();
    segnaMisura(n, { w: im.naturalWidth, h: im.naturalHeight });
  }, [urlDi, segnaMisura]);

  // LE PAGINE AVANTI (vedi `pagineAvanti`): dopo quella a schermo, in
  // ordine, e il giro si ferma quando si volta — la voltata ne fa partire
  // uno nuovo da dove sei, e quel che e' gia' pronto resta pronto. IN VOLO
  // NE STANNO `IN_VOLO` alla volta, non una: misurato col Drive finto, una
  // alla volta ogni richiesta aspettava la sua latenza con la banda ferma,
  // e le voltate svelte aspettavano lo stesso.
  const preparaAvanti = useCallback(async (ultima, mio) => {
    const l = live.current;
    const coda = daPreparare(ultima, l.pages, l.avanti || 0, new Set(urls.current.keys()));
    const lavora = async () => {
      while (coda.length && gettone.current === mio) await urlDi(coda.shift()).catch(() => {});
    };
    await Promise.all(Array.from({ length: IN_VOLO }, lavora));
  }, [urlDi]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const blob = await fileDaLeggere(book, { onProgress: (p) => !dead && setDiscesa(fraseDiscesa(p)) });
        if (!blob) throw new Error("file mancante");
        lontano.current = !!blob.daLontano;
        live.current.avanti = pagineAvanti({ lontano: lontano.current, connessione: navigator.connection });
        const a = await apriFumetto(blob);
        if (dead) return;
        if (!a.pagine.length) throw new Error("nessuna pagina");
        archivio.current = a;
        const n = a.pagine.length;
        live.current.pages = n;
        live.current.page = paginaDaAprire(startCfi, getCfi(book.id), n);
        setPages(n);
        setPage(live.current.page);
        // la pagina da cui si riparte si chiede SUBITO, insieme alle pagine
        // della misura qui sotto: in fila dopo di loro era un viaggio in piu'
        urlDi(live.current.page).catch(() => {});
        // i bordi si misurano PRIMA di mostrare la prima pagina, cosi' la
        // tavola compare gia' della misura giusta invece di assestarsi
        // sotto gli occhi — una volta nella vita del libro
        //
        // MA LA MISURA HA UN TETTO (`MISURA_MAX`): da Drive le cinque pagine
        // sono cinque viaggi in rete, e una che non torna teneva il lettore
        // fermo su «Apro il tomo…» per sempre (segnalato: «c'e' un motivo per
        // cui non riesco a leggere i manga?»). Oltre il tetto la tavola
        // compare coi bordi, e la misura, quando arriva, li toglie.
        if (leggiBordi(book.id) === null) {
          const misura = misuraBordi(a).then((misure) => {
            const b = bordiDaMisure(misure);
            // una misura che non ha guardato nessuna pagina non si scrive:
            // si riprova alla prossima apertura
            if (misure.some(Boolean)) scriviBordi(book.id, b);
            return b;
          });
          const b = await conAttesa(misura, MISURA_MAX).catch(() => null);
          if (dead) return;
          if (b) setBordi(b);
          else misura.then((x) => { if (!dead) setBordi(x); }).catch(() => {});
        }
        setStatusUi("ready");
      } catch (e) {
        if (dead) return;
        setPerche(e?.message === PERCHE_CBR_GRANDE ? PERCHE_CBR_GRANDE : "");
        setStatusUi("error");
      }
    })();
    return () => {
      dead = true;
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      urls.current.clear();
      pesi.current.clear();
      archivio.current?.chiudi?.();
    };
  }, [apertura]); // eslint-disable-line react-hooks/exhaustive-deps

  // IL CBR COMPRESSO TROPPO GRANDE SI CONVERTE DA QUI (`convertiLibroInCbz`):
  // un tocco, l'avanzamento sotto la candela, e il fumetto si riapre CBZ
  // allo stesso punto — i nomi delle pagine restano, e con loro l'ordine.
  const [convertendo, setConvertendo] = useState(null);
  async function convertiQui() {
    if (convertendo) return;
    setConvertendo({ letti: 0, misura: 0, pagine: 0 });
    try {
      const patch = await convertiLibroInCbz(book, { onProgress: setConvertendo });
      onCambiaLibro?.(patch);
      setPerche("");
      setStatusUi("loading");
      setApertura((n) => n + 1);
    } catch (e) {
      notify?.(`La conversione non è riuscita: ${e?.message || e}`);
    } finally {
      setConvertendo(null);
    }
  }

  useEffect(() => {
    if (status !== "ready" || nastro) return;
    live.current.page = page;
    live.current.ultima = mostrate.at(-1);
    live.current.prima = mostrate[0];
    const mio = ++gettone.current;
    // la voltata si misura da qui (`lib/voltate.js`): in che stato sono le
    // pagine che servono, e quando arrivano i byte
    misuraVoltata.current = {
      chiave: chiaveMostrate,
      t0: performance.now(),
      stati: mostrate.map((n) => (urls.current.has(n) ? "pronta" : inArrivo.current.has(n) ? "in arrivo" : "da chiedere")),
      doppia,
      prima: primoGiro.current,
    };
    applica({ s: 1, x: 0, y: 0 });
    if (boxRef.current) boxRef.current.scrollTop = 0;
    // UNA PAGINA CHE NON ARRIVA NON SI PORTA VIA LA COPPIA (segnalato dal
    // lettore con Kill Six Billion Demons: schermo nero e «Questa pagina non
    // si lascia aprire» sulle pagine 6-7). Con `Promise.all` bastava una
    // delle due per spegnere tutt'e due; adesso chi non arriva si riprova
    // una volta, e se non arriva ancora si mostra l'altra e si dice QUALE
    // manca.
    const prova = (n) => urlDi(n).catch(() => new Promise((r) => setTimeout(r, RIPROVA)).then(() => urlDi(n)));
    Promise.allSettled(mostrate.map(prova))
      .then((esiti) => {
        if (gettone.current !== mio) return;
        const rotte = mostrate.filter((_, i) => esiti[i].status !== "fulfilled" || !esiti[i].value);
        if (rotte.length) {
          if (lontano.current && !driveProntoOra()) setSenzaChiave(true);
          else notify?.(rotte.length === mostrate.length ? "Questa pagina non si lascia aprire" : `La pagina ${rotte.join(" e ")} non si lascia aprire`);
        }
        const buone = mostrate.map((n, i) => ({ n, url: esiti[i].status === "fulfilled" ? esiti[i].value : null })).filter((x) => x.url);
        if (!buone.length) return;
        if (misuraVoltata.current?.chiave === chiaveMostrate) {
          misuraVoltata.current.tPagine = performance.now();
          misuraVoltata.current.kb = buone.reduce((t, x) => t + (pesi.current.get(x.n) || 0), 0) / 1024;
        }
        if (sfumaDa(disegnato.current, chiaveMostrate, { nastro: live.current.nastro, acceso: live.current.sfuma && live.current.intera })) {
          const d = disegnato.current;
          const via = d.srcs
            .map((x, i) => ({ n: x.n, url: x.url, q: d.disegno.pagine.find((y) => y.indice === i) }))
            .filter((x) => x.q);
          if (via.length) setUscente({ id: ++contaSfuma.current, via: false, w: d.disegno.foglio.w, h: d.disegno.foglio.h, pagine: via });
        }
        setSrcs(buone);
        setSrcsDi(chiaveMostrate);
        sfoltisci(page);
        preDecodifica();
        // le vicine si preparano DOPO quella che si guarda, nel verso in
        // cui si legge: la prossima per prima. In doppia pagina si MISURANO
        // anche, perche' una tavola larga cambia la coppia prima di arrivarci
        const primo = mostrate[0];
        const ultimo = mostrate.at(-1);
        // (misurate anche a pagina singola: con la misura gia' in mano la
        // pagina dopo compare subito, senza un fotogramma vuoto)
        const vicine = doppia ? [ultimo + 1, ultimo + 2, primo - 1, primo - 2] : [page + 1, page - 1];
        for (const n of vicine) {
          if (n < 1 || n > pages) continue;
          misuraDi(n).catch(() => {});
        }
        preparaAvanti(ultimo, mio);
      });
    flush();
    if (pages > 0 && mostrate.includes(pages)) {
      setStatus(book.id, "read");
      setEndCard((v) => (v === null ? "shown" : v));
    }
    // una voltata e' la prova che qualcuno sta leggendo: lo schermo resta
    // sveglio e il tempo di lettura si conta da qui
    if (primoGiro.current) primoGiro.current = false;
    else onAlive?.();
  }, [status, chiaveMostrate, nastro, pages, book.id, urlDi, sfoltisci, flush, riprova]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- IL NASTRO (vedi `altezzeNastro` in lib/fumetto.js) ----------------
  // La pagina segue lo scorrimento: quella sotto il primo terzo dello
  // schermo e' «quella che leggi». Il cursore, un segnalibro o il numero
  // scritto a mano invece portano il nastro alla pagina: `daScorrere` dice
  // da che parte e' arrivata la pagina nuova.
  const larghezzaNastro = Math.min(riquadro?.w || 0, NASTRO_MAX);
  const altezze = nastro ? altezzeNastro({ totale: pages, nats, bordi: settings.ritaglia !== false ? bordi : null, larghezza: larghezzaNastro }) : null;
  const cime = altezze ? cimeNastro(altezze) : null;
  const cimeRef = useRef(null);
  cimeRef.current = cime;
  const daScorrere = useRef(null);
  const cimaVista = useRef(null);
  const quadro = useRef(0);

  const alloScorrere = () => {
    if (!nastro || quadro.current) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0;
      const b = boxRef.current;
      const c = cimeRef.current;
      if (!b || !c) return;
      const n = paginaAlPunto(c, b.scrollTop + b.clientHeight / 3);
      if (n !== live.current.page) {
        daScorrere.current = n;
        live.current.page = n;
        setPage(n);
      }
    });
  };

  useEffect(() => {
    if (status !== "ready" || !nastro || !cime) return;
    live.current.page = page;
    live.current.ultima = page;
    // arrivata da fuori (cursore, segnalibro, apertura): il nastro ci va
    if (daScorrere.current !== page && boxRef.current) {
      boxRef.current.scrollTop = cime[page - 1] || 0;
      cimaVista.current = { n: page, y: cime[page - 1] || 0 };
    }
    daScorrere.current = page;
    const da = Math.max(1, page - NASTRO_DIETRO);
    const a = Math.min(pages, page + NASTRO_AVANTI);
    for (let n = da; n <= a; n++) {
      urlDi(n)
        .then((url) => {
          if (url) setVista((v) => (v[n] === url ? v : { ...v, [n]: url }));
        })
        .catch(() => {
          if (lontano.current && !driveProntoOra()) setSenzaChiave(true);
        });
    }
    sfoltisci(page);
    // e oltre la finestra montata, le pagine avanti si preparano in fila
    preparaAvanti(a, ++gettone.current);
    // chi e' uscito dalla finestra perde l'immagine (il suo indirizzo e'
    // appena stato revocato) ma non il posto: l'altezza resta
    setVista((v) => {
      const dentro = Object.fromEntries(Object.entries(v).filter(([n]) => Math.abs(n - page) <= VICINE));
      return Object.keys(dentro).length === Object.keys(v).length ? v : dentro;
    });
    flush();
    if (pages > 0 && page === pages) {
      setStatus(book.id, "read");
      setEndCard((v) => (v === null ? "shown" : v));
    }
    if (primoGiro.current) primoGiro.current = false;
    else onAlive?.();
  }, [status, nastro, page, pages, !!cime, riprova]); // eslint-disable-line react-hooks/exhaustive-deps

  // L'ANCORA DEL NASTRO: quando una pagina SOPRA quella che leggi riceve la
  // sua misura vera (era una stima), tutto il nastro sotto si sposta, e la
  // pagina che stavi leggendo scapperebbe di qualche centinaio di pixel. Si
  // sposta lo scorrimento della stessa quantita', prima che si veda.
  useLayoutEffect(() => {
    if (!nastro || !cime || !boxRef.current) return;
    // la stessa pagina di prima, e la sua cima si e' mossa: e' il nastro
    // sopra di lei che e' cresciuto (una pagina nuova non e' uno spostamento)
    const n = live.current.page;
    const cima = cime[n - 1];
    const prima = cimaVista.current;
    if (prima && prima.n === n && cima !== prima.y) boxRef.current.scrollTop += cima - prima.y;
    cimaVista.current = { n, y: cima };
  });

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => notify("Schermo intero non disponibile qui"));
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") (panel ? setPanel(null) : handleClose());
      // le frecce seguono lo SCHERMO: in un manga la freccia a sinistra
      // porta alla pagina dopo, che sta a sinistra
      if (e.key === "ArrowRight") (verso === "rtl" ? indietroDiUna : avanti)();
      if (e.key === "ArrowLeft") (verso === "rtl" ? avanti : indietroDiUna)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, handleClose, avanti, indietroDiUna, verso]);

  // il tasto indietro del dispositivo: prima il pannello, poi il libro,
  // dalla porta di sempre — e' li' che la pagina si salva
  useEffect(() => {
    if (!indietro) return;
    indietro.current = () => {
      if (panel) { setPanel(null); return true; }
      handleClose();
      return false;
    };
    return () => { indietro.current = null; };
  }, [indietro, panel, handleClose]);

  useEffect(() => {
    const riassesta = () => {
      const m = misure();
      if (m) applica(limita(st.current, m.foglio, m.riquadro));
    };
    window.addEventListener("resize", riassesta);
    return () => window.removeEventListener("resize", riassesta);
  }, []);

  // il riquadro si misura da se': ruotando il tablet o entrando a schermo
  // intero cambia lui, e la pagina si ridisegna sulla sua misura nuova
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const misura = () => setRiquadro({ w: el.clientWidth, h: el.clientHeight });
    misura();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", misura);
      return () => window.removeEventListener("resize", misura);
    }
    const ro = new ResizeObserver(misura);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReaderSettings(next);
  }

  function cambiaVerso() {
    const v = verso === "rtl" ? "ltr" : "rtl";
    setVerso(v);
    scriviVerso(book.id, v);
    notify?.(v === "rtl" ? "Si legge da destra a sinistra, come un manga" : "Si legge da sinistra a destra");
  }

  function cambiaAdatta() {
    const v = intera ? "nastro" : "intera";
    setAdatta(v);
    scriviAdatta(v);
    applica({ s: 1, x: 0, y: 0 });
    // entrando nel nastro si parte dalla pagina che si guardava
    daScorrere.current = null;
    cimaVista.current = null;
  }

  function addMark() {
    const m = { id: crypto.randomUUID(), cfi: String(live.current.page), label: `pag. ${live.current.page}`, createdAt: Date.now() };
    const next = [...marks, m];
    setMarks(next);
    saveMarks(book.id, next);
    notify?.("Segnalibro riposto tra le pagine 📑");
  }

  function removeMark(m) {
    const next = marks.filter((x) => x.id !== m.id);
    setMarks(next);
    saveMarks(book.id, next);
  }

  // ---- il gesto: lo stesso della tavola, piu' il tocco e la scorsa ------
  const misure = () => {
    const b = boxRef.current;
    const i = imgRef.current;
    if (!b || !i) return null;
    return {
      foglio: { w: i.offsetWidth, h: i.offsetHeight },
      riquadro: { w: b.clientWidth, h: b.clientHeight },
      rect: b.getBoundingClientRect(),
    };
  };
  const applica = (nuovo) => {
    st.current = nuovo;
    if (imgRef.current) imgRef.current.style.transform = `translate(${nuovo.x}px, ${nuovo.y}px) scale(${nuovo.s})`;
  };
  const dalCentro = (m, cx, cy) => ({ x: cx - (m.rect.left + m.rect.width / 2), y: cy - (m.rect.top + m.rect.height / 2) });

  const giu = (e) => {
    if (e.target.closest("button, input, a")) return;
    if (intera) {
      try { boxRef.current?.setPointerCapture(e.pointerId); } catch { /* puntatore gia' andato */ }
    }
    dita.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dita.current.size === 1) {
      partenza.current = { x: e.clientX, y: e.clientY, quando: Date.now(), mosso: false };
    } else {
      partenza.current = null;
    }
    if (dita.current.size === 2 && intera) {
      const [a, b] = [...dita.current.values()];
      pizzico.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mezzo: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, st: st.current };
    }
  };

  const muovi = (e) => {
    if (!dita.current.has(e.pointerId)) return;
    const prima = dita.current.get(e.pointerId);
    dita.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = partenza.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOSSA) p.mosso = true;
    if (!intera) return;
    const m = misure();
    if (!m) return;
    if (dita.current.size === 2 && pizzico.current) {
      const [a, b] = [...dita.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mezzo = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const c = dalCentro(m, mezzo.x, mezzo.y);
      const c0 = dalCentro(m, pizzico.current.mezzo.x, pizzico.current.mezzo.y);
      const base = pizzico.current.st;
      const scala = base.s * (dist / pizzico.current.dist);
      const spostato = { ...base, x: base.x + (c.x - c0.x), y: base.y + (c.y - c0.y) };
      applica(zoomAttorno(spostato, scala, c.x, c.y, m.foglio, m.riquadro));
      return;
    }
    if (dita.current.size === 1 && st.current.s > 1.01) {
      applica(limita({ ...st.current, x: st.current.x + (e.clientX - prima.x), y: st.current.y + (e.clientY - prima.y) }, m.foglio, m.riquadro));
    }
  };

  const su = (e) => {
    if (!dita.current.has(e.pointerId)) return;
    dita.current.delete(e.pointerId);
    const p = partenza.current;
    if (dita.current.size > 0) {
      pizzico.current = null;
      partenza.current = null;
      return;
    }
    pizzico.current = null;
    partenza.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const durata = Date.now() - p.quando;
    // LA SCORSA VOLTA PAGINA, nel verso della lettura: a pagina intera e
    // senza zoom, un dito che scorre a sinistra porta alla pagina dopo (o
    // a quella prima, in un manga)
    if (intera && st.current.s <= 1.01 && Math.abs(dx) > SCORSA && Math.abs(dx) > 2 * Math.abs(dy)) {
      const versoSinistra = dx < 0;
      (versoSinistra === (verso !== "rtl") ? avanti : indietroDiUna)();
      return;
    }
    if (p.mosso || durata > PRESSIONE) return;
    // il doppio tocco: da intera si avvicina al punto toccato, da vicino
    // torna intera — qualunque sia la scala
    const u = ultimoTocco.current;
    ultimoTocco.current = { x: e.clientX, y: e.clientY, quando: Date.now() };
    if (intera && u && Date.now() - u.quando < DOPPIO && Math.hypot(e.clientX - u.x, e.clientY - u.y) < 24) {
      // il primo tocco della coppia aveva messo in attesa le barre: il
      // secondo dice che era uno zoom, e le barre non si toccano
      clearTimeout(attesaBarre.current);
      ultimoTocco.current = null;
      const m = misure();
      if (m) {
        const c = dalCentro(m, e.clientX, e.clientY);
        applica(doppioTocco(st.current, c.x, c.y, m.foglio, m.riquadro));
      }
      return;
    }
    // da vicino il tocco non volta: si sta guardando
    if (st.current.s > 1.01) return;
    const rel = e.pointerType === "mouse" ? null : e.clientX / (window.innerWidth || 1);
    const cosa = tocco(rel, verso, { nastro });
    // LA VOLTATA E' SUBITO, LE BARRE ASPETTANO UN SOFFIO. Il doppio tocco
    // e' due tocchi, e il primo dei due arrivava qui come un tocco
    // qualunque: al centro accendeva le barre (e il secondo zoomava con
    // le barre accese), ai bordi voltava pagina e lo zoom finiva sulla
    // pagina dopo — preso dal banco, non dal video. Una voltata non puo'
    // aspettare trecento millisecondi per sapere se ne arriva un altro,
    // quindi ai bordi si volta e basta e il doppio tocco li' non esiste
    // (`ultimoTocco` azzerato); le barre invece un soffio lo reggono, e
    // aspettano `DOPPIO` — se nel frattempo arriva il secondo tocco, era
    // uno zoom.
    if (cosa === "next" || cosa === "prev") {
      ultimoTocco.current = null;
      (cosa === "next" ? avanti : indietroDiUna)();
      return;
    }
    clearTimeout(attesaBarre.current);
    attesaBarre.current = setTimeout(() => setChrome((c) => !c), DOPPIO);
  };

  // IL DITO PRESO DAL BROWSER NON E' UN TOCCO. Nel nastro lo scorrimento e'
  // del browser: appena il dito passa la sua soglia arriva `pointercancel`
  // (a 0,0), e trattato come un `pointerup` sembrava un tocco breve sul
  // bordo sinistro — e il nastro saltava di uno schermo contro il dito.
  // Riprodotto sull'app intera con la sequenza di Chrome Android: ogni
  // trascinata, 720 px all'indietro.
  const annulla = (e) => {
    dita.current.delete(e.pointerId);
    pizzico.current = null;
    partenza.current = null;
  };

  const pct = pages ? Math.round((page / pages) * 100) : 0;
  // la levetta e' quella del PDF («Togli i margini»), condivisa in
  // `bc_reader`: spenta, la scansione si vede com'e', bordo compreso
  const bordiVivi = settings.ritaglia !== false ? bordi : null;
  // le pagine si disegnano quando tutte quelle a schermo hanno una misura
  // e un indirizzo: una coppia mezza pronta e' peggio di un fotogramma vuoto
  const pronte = srcsDi === chiaveMostrate && srcs.length > 0 && srcs.every((x) => nats[x.n]);
  const disegno = !pronte || nastro
    ? null
    : doppia
      ? disegnaCoppia({ nats: srcs.map((x) => nats[x.n]), riquadro, bordi: bordiVivi, verso })
      : (() => {
          const d = disegnaPagina({ nat: nats[page], riquadro, bordi: bordiVivi });
          return d && { foglio: d.foglio, pagine: [{ indice: 0, x: 0, foglio: d.foglio, immagine: d.immagine }] };
        })();

  // il disegno dei fogli dopo e prima, se le loro pagine hanno gia' una misura
  const disegniPronti = [0, 1].map((k) => {
    const pg = prossimo.filter((x) => x.foglio === k);
    if (nastro || !intera || !pg.length || !pg.every((x) => nats[x.n])) return null;
    if (pg.length > 1) return disegnaCoppia({ nats: pg.map((x) => nats[x.n]), riquadro, bordi: bordiVivi, verso });
    const d = disegnaPagina({ nat: nats[pg[0].n], riquadro, bordi: bordiVivi });
    return d && { foglio: d.foglio, pagine: [{ indice: 0, x: 0, foglio: d.foglio, immagine: d.immagine }] };
  });

  const inScena = fogliInScena({ aSchermo: srcs, uscenti: uscente?.pagine, dopo: prossimo });

  // LA VOLTATA SFUMA (`sfumaDa`). Il foglio di prima resta dov'e' finche'
  // il nuovo non e' pronto (`disegnoVisto`: le stesse immagini, niente nero
  // in mezzo); poi le sue pagine — gli STESSI elementi <img>, che passano
  // nella lista delle uscenti con la loro chiave — stanno sopra e svaniscono
  // quando il nuovo e' decodificato. Copie <img> nuove andrebbero
  // decodificate da capo (fotogrammi neri), e la foto su canvas di una volta
  // ridecodificava la pagina sul filo principale (146 ms bloccati).
  useLayoutEffect(() => {
    if (nastro) disegnato.current = null;
    else if (disegno) disegnato.current = { chiave: srcsDi, srcs, disegno };
  });
  const disegnoVisto =
    disegno || (!nastro && intera && live.current.sfuma && disegnato.current?.chiave === srcsDi ? disegnato.current.disegno : null);
  useEffect(() => {
    if (!uscente || uscente.via || !pronte) return;
    let vivo = true;
    const ims = [...(imgRef.current?.querySelectorAll("img:not([data-dopo]):not([data-via])") || [])];
    const tetto = new Promise((r) => setTimeout(r, 400));
    Promise.race([Promise.all(ims.map((im) => im.decode().catch(() => {}))), tetto]).then(() => {
      if (vivo) setUscente((u) => (u?.id === uscente.id ? { ...u, via: true } : u));
    });
    return () => {
      vivo = false;
    };
  }, [uscente, pronte]);
  // la voltata e' finita quando le pagine nuove sono decodificate: allora
  // si annota (con un tetto, come ogni attesa)
  useEffect(() => {
    const m = misuraVoltata.current;
    if (!pronte || !m || m.chiave !== srcsDi || m.tPagine == null || m.fatta) return;
    m.fatta = true;
    const ims = [...(imgRef.current?.querySelectorAll("img:not([data-dopo]):not([data-via])") || [])];
    const tetto = new Promise((r) => setTimeout(r, 5000));
    Promise.race([Promise.all(ims.map((im) => im.decode().catch(() => {}))), tetto]).then(() => {
      const c = globalThis.navigator?.connection;
      segnaVoltata(
        vocePerVoltata({
          ...m,
          tVista: performance.now(),
          da: lontano.current ? "drive" : "tablet",
          rete: c ? [c.type, c.effectiveType, c.downlink ? `${c.downlink} Mbit/s` : ""].filter(Boolean).join(" ") : "",
        })
      );
    });
  }, [pronte, srcsDi]);
  useEffect(() => {
    if (!uscente) return;
    // ogni attesa ha un tetto: una pagina che non si decodifica, o
    // un'animazione che non chiude, non lasciano la foto sopra per sempre
    const t = setTimeout(() => setUscente((u) => (u?.id === uscente.id ? null : u)), uscente.via ? SFUMA_MS + 250 : 3000);
    return () => clearTimeout(t);
  }, [uscente]);

  function cambiaDoppia() {
    scriviDoppia(orientamento(riquadro), doppia ? "no" : "si");
    setSceltaDoppia((n) => n + 1);
    applica({ s: 1, x: 0, y: 0 });
  }

  function cambiaSposta() {
    const v = sposta ? 0 : 1;
    setSposta(v);
    scriviSposta(book.id, v);
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        background: "#0b0a10",
        color: C.text,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <div
        ref={boxRef}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={annulla}
        onWheel={(e) => {
          if (intera) (e.deltaY > 0 ? avanti : indietroDiUna)();
        }}
        onScroll={alloScorrere}
        style={{
          position: "absolute",
          inset: 0,
          display: nastro ? "block" : "flex",
          alignItems: intera ? "center" : "flex-start",
          justifyContent: "center",
          overflowY: intera ? "hidden" : "auto",
          overflowX: "hidden",
          touchAction: intera ? "none" : "pan-y",
          cursor: "pointer",
        }}
      >
        {/* IL FOGLIO E' LA TAVOLA SENZA I BORDI DELLA SCANSIONE (o la
            coppia, in doppia pagina): per ogni pagina un riquadro che
            ritaglia, e dentro l'immagine intera spostata di quanto basta a
            lasciare fuori la cornice. E' il foglio che lo zoom misura e
            trasforma (`imgRef`), non l'immagine. Finche' non
            si sa quanto e' grande il file (`onLoad`) il foglio resta
            invisibile: un fotogramma a misura sbagliata e' peggio di uno
            vuoto. */}
        {nastro && cime && (
          <div style={{ position: "relative", width: larghezzaNastro, height: cime.at(-1), margin: "0 auto" }}>
            {Object.entries(vista).map(([k, url]) => {
              const n = Number(k);
              const d = disegnaPagina({ nat: nats[n], riquadro: { w: larghezzaNastro, h: 1 }, bordi: bordiVivi, modo: "larghezza" });
              return (
                <div
                  key={n}
                  style={{ position: "absolute", overflow: "hidden", left: 0, top: cime[n - 1], width: larghezzaNastro, height: altezze[n - 1] }}
                >
                  <img
                    src={url}
                    alt={archivio.current?.pagine?.[n - 1] || ""}
                    draggable={false}
                    onLoad={(e) => segnaMisura(n, { w: e.target.naturalWidth, h: e.target.naturalHeight })}
                    style={{
                      position: "absolute",
                      display: "block",
                      maxWidth: "none",
                      visibility: d ? "visible" : "hidden",
                      left: d?.immagine.x,
                      top: d?.immagine.y,
                      width: d?.immagine.w,
                      height: d?.immagine.h,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {!nastro && srcs.length > 0 && (
          <div
            ref={imgRef}
            style={{
              position: "relative",
              flexShrink: 0,
              transformOrigin: "center",
              willChange: "transform",
              width: disegnoVisto?.foglio.w,
              height: disegnoVisto?.foglio.h,
              visibility: disegnoVisto ? "visible" : "hidden",
            }}
          >
            {[
              ...srcs.map((x, i) => {
                const d = disegnoVisto?.pagine.find((q) => q.indice === i);
                return (
                  <div
                    key={x.n}
                    style={{
                      position: "absolute",
                      overflow: "hidden",
                      top: 0,
                      left: d?.x ?? 0,
                      width: d?.foglio.w,
                      height: d?.foglio.h,
                    }}
                  >
                    <img
                      src={x.url}
                      alt={archivio.current?.pagine?.[x.n - 1] || ""}
                      draggable={false}
                      onLoad={(e) => segnaMisura(x.n, { w: e.target.naturalWidth, h: e.target.naturalHeight })}
                      style={{
                        position: "absolute",
                        display: "block",
                        maxWidth: "none",
                        left: d?.immagine.x,
                        top: d?.immagine.y,
                        width: d?.immagine.w,
                        height: d?.immagine.h,
                      }}
                    />
                  </div>
                );
              }),
              ...inScena.uscenti.map((x) => {
                const q = x.q;
                const ox = ((disegnoVisto?.foglio.w || 0) - uscente.w) / 2;
                const oy = ((disegnoVisto?.foglio.h || 0) - uscente.h) / 2;
                return (
                  <div
                    key={x.n}
                    aria-hidden="true"
                    onAnimationEnd={() => setUscente((u) => (u?.id === uscente.id ? null : u))}
                    style={{
                      position: "absolute",
                      overflow: "hidden",
                      top: oy,
                      left: ox + q.x,
                      width: q.foglio.w,
                      height: q.foglio.h,
                      zIndex: 1,
                      visibility: "visible",
                      pointerEvents: "none",
                      animation: uscente.via ? `bc-svanisci ${SFUMA_MS}ms ease-in-out forwards` : "none",
                    }}
                  >
                    <img
                      data-via=""
                      src={x.url}
                      alt=""
                      draggable={false}
                      style={{ position: "absolute", display: "block", maxWidth: "none", left: q.immagine.x, top: q.immagine.y, width: q.immagine.w, height: q.immagine.h }}
                    />
                  </div>
                );
              }),
              ...inScena.dopo.map((x) => {
                const d = disegniPronti[x.foglio]?.pagine.find((q) => q.indice === x.indice);
                return (
                  <div
                    key={x.n}
                    aria-hidden="true"
                    style={{ position: "absolute", overflow: "hidden", top: 0, left: d?.x ?? 0, width: d?.foglio.w ?? 1, height: d?.foglio.h ?? 1, opacity: 0.01, zIndex: -1, pointerEvents: "none" }}
                  >
                    <img
                      data-dopo=""
                      src={x.url}
                      alt=""
                      draggable={false}
                      onLoad={(e) => segnaMisura(x.n, { w: e.target.naturalWidth, h: e.target.naturalHeight })}
                      style={{ position: "absolute", display: "block", maxWidth: "none", left: d?.immagine.x, top: d?.immagine.y, width: d?.immagine.w ?? 1, height: d?.immagine.h ?? 1 }}
                    />
                  </div>
                );
              }),
            ]}
          </div>
        )}
      </div>

      {/* la luce si abbassa con lo stesso velo del PDF: e' la luminosita'
          delle preferenze di lettura, una per tutti i libri */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, background: "#000", opacity: 1 - settings.brightness }} />

      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "#1b1826",
            color: C.muted,
          }}
        >
          <span style={{ fontSize: 40, animation: "bc-flicker 3s ease-in-out infinite" }}>🕯️</span>
          <span style={{ fontFamily: FONT_TITLE, fontSize: F.rilievo }}>Apro il tomo…</span>
          {discesa && <span style={{ fontSize: F.piccolo, fontVariantNumeric: "tabular-nums" }}>{discesa}</span>}
        </div>
      )}

      {senzaChiave && (
        <RicollegaDrive
          alto={chrome ? altezzaBarra : 0}
          onFatto={() => {
            setSenzaChiave(false);
            setRiprova((n) => n + 1);
          }}
        />
      )}
      {status === "error" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            background: "#1b1826",
            color: C.text,
            textAlign: "center",
            padding: 24,
          }}
        >
          <span style={{ fontSize: 40 }}>📕</span>
          <span style={{ maxWidth: px(560) }}>
            {perche
              ? "Questo CBR ha le pagine compresse ed è troppo grande per aprirlo così: il browser dovrebbe tenerlo tutto in memoria. Lo converto in CBZ, una volta sola — le pagine restano le stesse, nello stesso ordine."
              : "Questo fumetto non si lascia aprire… l'archivio potrebbe essere danneggiato o senza immagini dentro, oppure è nel cloud e ora sei offline."}
          </span>
          {perche && (
            <>
              <button
                onClick={convertiQui}
                disabled={!!convertendo}
                style={{ minHeight: 44, padding: "10px 22px", borderRadius: R.piccolo, border: `1px solid ${C.accent}88`, color: C.accent, fontVariantNumeric: "tabular-nums" }}
              >
                {convertendo ? (convertendo.carico ? fraseCarico(convertendo) : fraseConversione(convertendo)) : "Converti in CBZ"}
              </button>
              {mappaDrive()[book.id] && (
                <span style={{ fontSize: F.piccolo, color: C.muted, maxWidth: px(520) }}>
                  Su Google Drive il CBZ prende il posto del CBR, che va nel cestino di Drive: da lì lo riprendi per un mese.
                </span>
              )}
            </>
          )}
          <button onClick={handleClose} style={{ padding: "10px 22px", borderRadius: R.piccolo, border: `1px solid ${C.border}`, color: C.muted }}>
            Torna alla Libreria
          </button>
        </div>
      )}

      {chrome && (
        <>
          <BarraDelLibro
            titolo={book.title}
            onClose={handleClose}
            conNome={nomiNeiTasti}
            dueRighe={dueRighe}
            onAltezza={setAltezzaBarra}
            musica={<MusicaInBarra music={music} onMusicToggle={onMusicToggle} onMusicNext={onMusicNext} onMusicVolume={onMusicVolume} onMusicStop={onMusicStop} onMusicRoom={onMusicRoom} onClose={handleClose} />}
            tasti={
              <>
                {/* IL VERSO: un manga si legge da destra, e il tasto lo dice
                    col glifo — la freccia punta dove sta la pagina dopo */}
                <TastoBarra onClick={cambiaVerso} attivo={verso === "rtl"} conNome={nomiNeiTasti} nome="Verso" glifo={verso === "rtl" ? "⇦" : "⇨"} />
                {/* il NASTRO: le pagine una sotto l'altra, e si scorre */}
                <TastoBarra onClick={cambiaAdatta} attivo={nastro} conNome={nomiNeiTasti} nome="Scorri" glifo="↕" />
                {/* due pagine affiancate: solo a pagina intera, dove ha senso */}
                {intera && pages > 1 && (
                  <TastoBarra onClick={cambiaDoppia} attivo={doppia} conNome={nomiNeiTasti} nome="Doppia" glifo="📖" />
                )}
                <TastoBarra
                  onClick={() => setPanel(panel === "marks" ? null : "marks")}
                  attivo={panel === "marks"}
                  conNome={nomiNeiTasti}
                  nome="Segnalibri"
                  glifo="📑"
                />
                {serveTastoSchermo({ abilitato: document.fullscreenEnabled, giaTuttoSchermo: apertaATuttoSchermo() }) && (
                  <TastoBarra onClick={toggleFullscreen} attivo={isFs} conNome={nomiNeiTasti} nome={isFs ? "Esci" : "Schermo"} glifo="⛶" />
                )}
              </>
            }
            // 🌙 apre la luce E il ritaglio dei bordi: sta in coda come la
            // «Notte» del PDF
            coda={
              <TastoBarra
                onClick={() => setPanel(panel === "luce" ? null : "luce")}
                attivo={panel === "luce"}
                conNome={nomiNeiTasti}
                nome="Luce"
                glifo="🌙"
                stile={{ fontSize: F.rilievo }}
              />
            }
          />

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 25,
              padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
              background: `${C.surface}f2`,
              backdropFilter: "blur(8px)",
              borderTop: `1px solid ${C.border}`,
              animation: "bc-fade-in 0.2s ease-out",
            }}
          >
            <input
              type="range"
              min={1}
              max={Math.max(1, pages)}
              value={page}
              onChange={(e) => setPage(parseInt(e.target.value, 10))}
              aria-label="Pagina"
              style={{ width: "100%", accentColor: C.accent, direction: verso === "rtl" ? "rtl" : "ltr" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
              <span>{pct}%</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 10px" }}>
                {verso === "rtl" ? "⇦ da destra a sinistra" : ""}
              </span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = parseInt(jump, 10);
                  if (Number.isFinite(n)) goToPage(n);
                  setJump("");
                }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  value={jump}
                  onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder={mostrate.join("–")}
                  aria-label="Vai a pagina"
                  style={{
                    width: 58,
                    padding: "3px 7px",
                    borderRadius: R.piccolo,
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    color: C.text,
                    fontSize: F.minuscolo,
                    textAlign: "right",
                    outline: "none",
                  }}
                />
                <span>/ {pages || "…"}</span>
              </form>
            </div>
          </div>
        </>
      )}

      {panel === "luce" && (
        <div
          style={{
            position: "absolute",
            right: 10,
            top: altezzaBarra + px(6),
            zIndex: 30,
            width: `min(92%, ${px(260)}px)`,
            padding: 16,
            borderRadius: R.medio,
            border: `1px solid ${C.border}`,
            background: `${C.surface}fa`,
            boxShadow: "0 10px 40px #00000088",
            animation: "bc-fade-in 0.2s ease-out",
          }}
        >
          <div style={{ fontSize: F.nota, color: C.muted, marginBottom: 4 }}>Luminosità</div>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={settings.brightness}
            onChange={(e) => updateSettings({ brightness: parseFloat(e.target.value) })}
            aria-label="Luminosità"
            style={{ width: "100%", accentColor: C.accent }}
          />
          <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>
            {intera ? "Pagina intera: due dita o un doppio tocco per avvicinarti." : "Il nastro: scorri col dito da una pagina all'altra, senza voltare."}
          </div>

          {doppia && (
            <>
              <div style={{ height: 1, background: C.border, margin: "14px 0 12px" }} />
              {/* le coppie si sfasano quando una tavola larga non e' ancora
                  stata aperta: qui si rimettono a posto a mano */}
              <button
                onClick={cambiaSposta}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${sposta ? C.accent : C.border}`,
                  color: sposta ? C.accent : C.muted,
                  fontSize: F.nota,
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: F.corpo }}>{sposta ? "☑" : "☐"}</span>
                <span style={{ flex: 1 }}>Sposta le coppie di una pagina</span>
              </button>
              <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
                Se una tavola doppia appare spezzata su due coppie, le pagine sono sfasate: questo le rimette insieme.
              </div>
            </>
          )}

          <div style={{ height: 1, background: C.border, margin: "14px 0 12px" }} />
          {/* la stessa levetta del PDF, e la stessa preferenza: la' toglie
              il bianco attorno al testo, qui la cornice della scansione */}
          <button
            onClick={() => updateSettings({ ritaglia: settings.ritaglia === false })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: R.piccolo,
              border: `1px solid ${settings.ritaglia !== false ? C.accent : C.border}`,
              color: settings.ritaglia !== false ? C.accent : C.muted,
              fontSize: F.nota,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: F.corpo }}>{settings.ritaglia !== false ? "☑" : "☐"}</span>
            <span style={{ flex: 1 }}>Togli i bordi della scansione</span>
          </button>
          <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
            {bordi === null
              ? "Sto misurando i bordi di questo volume…"
              : vuoto(bordi)
                ? "Queste tavole arrivano già al bordo: non c'è niente da togliere."
                : `Qui se ne va ${Math.round((1 - (bordi.r - bordi.l) * (bordi.b - bordi.t)) * 100)}% di cornice, e la tavola cresce.`}
          </div>

          <div style={{ height: 1, background: C.border, margin: "14px 0 12px" }} />
          <button
            onClick={() => updateSettings({ sfumaFumetti: settings.sfumaFumetti === false })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: R.piccolo,
              border: `1px solid ${settings.sfumaFumetti !== false ? C.accent : C.border}`,
              color: settings.sfumaFumetti !== false ? C.accent : C.muted,
              fontSize: F.nota,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: F.corpo }}>{settings.sfumaFumetti !== false ? "☑" : "☐"}</span>
            <span style={{ flex: 1 }}>Dissolvenza fra le pagine</span>
          </button>
          <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
            {riduciMovimento()
              ? "Il tablet chiede meno animazioni: le pagine cambiano senza sfumare."
              : "La pagina di prima resta finché la nuova è pronta, poi sfuma in un terzo di secondo."}
          </div>
        </div>
      )}

      {panel === "marks" && (
        <Panel title="Segnalibri" onClose={() => setPanel(null)}>
          <button
            onClick={addMark}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: R.piccolo,
              marginBottom: 14,
              background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
              color: C.onAccent,
              fontWeight: 600,
              fontSize: F.corpo,
            }}
          >
            📑 Salva qui
          </button>
          {marks.length === 0 ? (
            <p style={{ color: C.muted }}>Nessun segnalibro ancora.</p>
          ) : (
            [...marks]
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}44` }}>
                  <button
                    onClick={() => {
                      goToPage(parseInt(m.cfi, 10) || 1);
                      setPanel(null);
                    }}
                    style={{ flex: 1, textAlign: "left", padding: "11px 6px", fontSize: F.corpo, color: C.text }}
                  >
                    {m.label}
                    <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                      {pages ? `al ${Math.round(((parseInt(m.cfi, 10) || 1) / pages) * 100)}% · ` : ""}
                      {new Date(m.createdAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                  <button onClick={() => removeMark(m)} aria-label="Elimina segnalibro" style={{ color: C.muted, padding: 8 }}>🗑</button>
                </div>
              ))
          )}
        </Panel>
      )}

      {endCard === "shown" && nextBook && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: chrome ? px(96) : px(30),
            zIndex: 32,
            width: `min(94%, ${px(440)}px)`,
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: "13px 16px",
            borderRadius: R.medio,
            background: `${C.card}fa`,
            border: `1px solid ${C.accent}55`,
            boxShadow: "0 12px 44px #000000aa",
            animation: "bc-fade-in 0.3s ease-out",
          }}
        >
          <div style={{ width: 52, flexShrink: 0 }}>
            <BookCover book={nextBook} radius={6} compact />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: F.minuscolo, color: C.muted }}>Fine del volume — il prossimo della saga</div>
            <div style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.rilievo, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextBook.title}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 5 }}>
              <button
                onClick={() => {
                  flush();
                  onReadNext(nextBook.id);
                }}
                style={{ fontSize: F.nota, fontWeight: 600, color: C.accent }}
              >
                Leggilo ora
              </button>
              <button onClick={() => setEndCard("dismissed")} style={{ fontSize: F.nota, color: C.muted }}>
                Più tardi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
