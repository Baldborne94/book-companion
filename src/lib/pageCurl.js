// La voltata di carta vera: le due facciate del foglio sono texture — la
// fotografia rasterizzata del capitolo — e un canvas disegna il foglio che
// si arrotola su un cilindro, colonna per colonna. Cosi' il testo si
// comprime e si piega davvero attorno alla piega, come su una pagina fisica.
//
// La rasterizzazione passa da SVG+foreignObject: l'HTML gia' fotografato del
// capitolo (stili CSSOM compresi) diventa un'immagine. Dentro un'immagine
// SVG la rete non esiste: i font vanno incorporati come data URI. Il canvas
// che ne esce e' "tainted" (restano url esterni non critici): non importa,
// non rileggiamo mai i pixel — si disegna soltanto.

const fontCache = new Map();
let fontCssCache = new Map();

async function toDataUri(url, tipo) {
  if (fontCache.has(url)) return fontCache.get(url);
  const buf = await (await fetch(url)).arrayBuffer();
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i += 32768) s += String.fromCharCode(...arr.subarray(i, i + 32768));
  const uri = `data:${tipo};base64,${btoa(s)}`;
  fontCache.set(url, uri);
  return uri;
}

async function inlineImportCss(importUrl) {
  if (fontCssCache.has(importUrl)) return fontCssCache.get(importUrl);
  let css = await (await fetch(importUrl)).text();
  const urls = [...new Set([...css.matchAll(/url\((https?:[^)]+)\)/g)].map((m) => m[1]))];
  for (const u of urls) {
    try {
      css = css.split(u).join(await toDataUri(u, "font/woff2"));
    } catch { /* un peso mancante: si va col fallback */ }
  }
  fontCssCache.set(importUrl, css);
  return css;
}

// Prepara l'HTML del capitolo per vivere dentro un'immagine SVG: font
// incorporati al posto degli @import, niente scrollbar, XML valido.
export async function bakeHtml(parkXml) {
  let xml = parkXml;
  const imports = [...xml.matchAll(/@import\s+url\((?:"|'|&quot;|&amp;quot;)?(https?:[^"'&)]+)/g)].map((m) => m[1]);
  for (const u of imports) {
    try {
      const css = await inlineImportCss(u);
      xml = xml.replace(/@import[^)]*\);?/, css.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
    } catch { /* senza rete il font resta di sistema */ }
  }
  // un @import rimasto (rete negata) porta con se' le & dell'indirizzo:
  // veleno per il parser XML, e comunque dentro un'immagine non caricherebbe
  xml = xml.replace(/@import[^)]*\);?/g, "");
  // dentro l'SVG i <link> non caricano nulla: le loro regole sono gia'
  // state serializzate dal CSSOM, il tag e' solo rumore
  xml = xml.replace(/<link\b[^>]*?\/?>/gi, "");
  return `<style>html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}html,body{scrollbar-width:none}</style>${xml}`;
}

// La finestra della doppia pagina rasterizzata in un'immagine: il capitolo
// intero sta nel foreignObject, la finestra lo ritaglia con un offset.
export function rasterize({ baked, w, h, offsetX, offsetY = 0, outW, outH, scale = 1 }) {
  // Due lezioni pagate care: l'offset sta negli attributi del
  // foreignObject (il left CSS negativo non viene dipinto nelle immagini
  // SVG), e il body va allargato all'intero capitolo — le colonne di
  // epub.js SBORDANO dal box del body, e nelle immagini SVG Chrome ritaglia
  // l'overflow: oltre la prima facciata usciva carta bianca. Allargare il
  // box non sposta le colonne di un pixel: le contiene soltanto.
  const largo = `<style>html,body{width:${w}px !important;max-width:none !important}</style>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW * scale}" height="${outH * scale}">` +
    `<g transform="scale(${scale})">` +
    `<foreignObject x="${-offsetX}" y="${-offsetY}" width="${w}" height="${h}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px">${largo}${baked}</div>` +
    `</foreignObject></g></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      // un'immagine "caricata" ma non decodificabile fa esplodere drawImage
      // al primo fotogramma: meglio scoprirlo qui, dove c'e' il ripiego
      const decodifica = img.decode ? img.decode() : Promise.resolve();
      decodifica
        .then(() => {
          // La texture si consegna gia' TRAVASATA su un canvas. Disegnare le
          // colonne del rotolo direttamente dall'immagine SVG costava 32ms a
          // fotogramma (ogni drawImage la ri-rasterizza); dallo stesso canvas
          // 0,6ms — misurato. Il travaso costa 0,1ms, una volta sola. Era
          // QUESTO a rendere il cilindro piu' lento del palco sul tablet.
          const cache = document.createElement("canvas");
          cache.width = img.width;
          cache.height = img.height;
          cache.getContext("2d").drawImage(img, 0, 0);
          resolve(cache);
        })
        .catch(() => reject(new Error("decodifica fallita")));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("raster fallito"));
    };
    img.src = url;
  });
}

// La pagina e' LANCIATA dal dito: parte veloce e si posa piano, come una
// carta vera lasciata andare. La vecchia campana (seno) partiva da ferma:
// il primo decimo di giro era immobile, e l'occhio aveva tutto il tempo di
// notare lo scambio fra pagina viva e fotografia.
export const easeCurl = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 1.7);

// La geometria del rotolo a un dato avanzamento: unica fonte di verita',
// condivisa fra il canvas (che disegna la piega) e i cloni vivi (che il
// Reader ritaglia e trasla alla stessa cadenza).
export function curlGeom(t, Wc) {
  const te = easeCurl(t);
  const P = Wc / 2;
  const c = P * (1 - te);
  // Stretto come una piega vera, e collassa a ZERO ESATTO atterrando. Il
  // vecchio minimo di 0,5px sembrava innocuo: lasciava pero' un arco
  // residuo di pi/2 px, e la pagina atterrata restava 2px fuori posto —
  // uno scatto del testo allo spegnimento, misurato. A raggio nullo l'arco
  // e' vuoto (il ciclo non gira) e l'ultimo fotogramma e' la pagina vera.
  // il collasso finale del raggio si distende sull'ultimo 14% invece che
  // sul 5%: strizzato, la piega spariva con uno scatto secco proprio
  // prima dell'atterraggio
  const r = Math.min(P * 0.14, 84) * (1 - te * 0.3) * Math.min(1, (1 - te) / 0.14);
  const arc = Math.PI * r;
  return { te, P, c, r, arc, landa: Math.max(0, P - c - arc) };
}

// Un fotogramma del foglio che si arrotola: il canvas disegna TUTTO.
//
// Si era provato a lasciargli solo la piega, con cloni vivi (iframe) per le
// parti ferme: allineamento perfetto al pixel, ma sul tablet i fotogrammi
// resi per giro sono scesi da 18/22 a 14/22 — comporre due iframe larghi
// un intero capitolo, ritagliati a ogni fotogramma, costa piu' di quanto
// valga. Il canvas resta UNO. La differenza di resa fra fotografia e
// pagina viva si nasconde invece con la dissolvenza in entrata e in
// uscita, che ora funziona davvero perche' primo e ultimo fotogramma
// coincidono con la pagina vera (raggio della piega a zero esatto).
//
//   oldImg  fotografia della doppia pagina PRIMA dello scambio (A|B)
//   newImg  fotografia DOPO lo scambio (C|D), o null se non ancora pronta
//   t       avanzamento 0..1 (gia' grezzo: l'easing sta qui dentro)
//   dir     "next" o "prev"
//   Wc, Hc  misure del canvas in px CSS
export function drawCurl(ctx, { oldImg, newImg, t, dir, Wc, Hc, paper, rows, sc = 1 }) {
  const { te, P, c, r, arc } = curlGeom(t, Wc);
  const next = dir === "next";
  ctx.clearRect(0, 0, Wc, Hc);

  // La meta' che il foglio deve ancora coprire NON si disegna: sotto c'e'
  // la pagina viva, ancora quella vecchia (lo scambio avviene alla fine del
  // giro, sotto il canvas gia' opaco). E' la mossa che toglie di mezzo il
  // difetto piu' ostinato: finche' il canvas ci ridipingeva sopra la
  // fotografia, meta' pagina FERMA restava resa con un peso diverso dal
  // vivo per tutto il giro. Ora resta viva, identica a se stessa, e il
  // canvas disegna solo cio' che si muove — meta' dei pixel di prima.

  const passo = 2;
  // NESSUNO spostamento verticale: un cilindro ad asse verticale, visto di
  // fronte, non alza nulla. La vecchia "alzata" spostava le colonne in su
  // via via verso l'orlo: le righe del testo si piegavano come gomma fusa,
  // e sotto le colonne sollevate restava una fessura non dipinta — la
  // macchia scura ai piedi del rotolo sui temi chiari.

  // il retro senza texture (fotografia nuova in ritardo o confine di
  // capitolo): carta nuda con righe accennate
  const retroNudo = (x, larg) => {
    ctx.fillStyle = paper;
    ctx.fillRect(x, 0, larg, Hc);
    if (rows) {
      ctx.fillStyle = rows;
      for (let y = Hc * 0.07; y < Hc * 0.93; y += 16) ctx.fillRect(x, y, larg, 2);
    }
  };

  // La pagina che il foglio ha gia' scoperto: e' quella NUOVA, e sotto non
  // c'e' ancora (lo scambio e' a fine giro), quindi la disegna il canvas.
  // Cresce da nulla mentre il foglio si arrotola.
  if (newImg) {
    const bordo = Math.min(P, c + r);
    const largo = P - bordo;
    if (largo > 0) {
      if (next) ctx.drawImage(newImg, (P + bordo) * sc, 0, largo * sc, Hc * sc, P + bordo, 0, largo, Hc);
      else ctx.drawImage(newImg, (P - bordo - largo) * sc, 0, largo * sc, Hc * sc, P - bordo - largo, 0, largo, Hc);
    }
  } else {
    const bordo = Math.min(P, c + r);
    const largo = P - bordo;
    if (largo > 0) retroNudo(next ? P + bordo : P - bordo - largo, largo);
  }

  // ombra portata davanti alla piega, sulla pagina che si sta scoprendo
  const fronteOmbra = c + r;
  const g = next
    ? ctx.createLinearGradient(P + fronteOmbra, 0, P + fronteOmbra + 46, 0)
    : ctx.createLinearGradient(P - fronteOmbra, 0, P - fronteOmbra - 46, 0);
  // mezze luci, non notte: le ombre sono tarate sulla carta chiara, dove
  // il buio pesante leggeva come sporco invece che come piega
  const buio = 0.13 * Math.sin(Math.PI * te);
  g.addColorStop(0, `rgba(0,0,0,${buio})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  if (next) ctx.fillRect(P + fronteOmbra, 0, 46, Hc);
  else ctx.fillRect(P - fronteOmbra - 46, 0, 46, Hc);

  // s misura la posizione lungo il foglio a partire dal dorso; il fronte e'
  // la meta' che parte, il retro la pagina che atterra sull'altra meta'.
  // sorgente fronte: colonna s della meta' in partenza; sorgente retro:
  // colonna specchiata della meta' in arrivo.
  const fronteSrc = (s) => (next ? P + s : P - s - passo);
  const retroSrc = (s) => (next ? P - s - passo : P + s);
  const destX = (d) => (next ? P + d : P - d - passo);


  // La fascia della piega si RIEMPIE di carta prima delle colonne. Le
  // colonne compresse finiscono a larghezze frazionarie e fra una e
  // l'altra restano fessure sub-pixel: finche' sotto c'era la fotografia
  // dell'intera pagina non si vedevano, ma sotto i cloni vivi ogni fessura
  // e' una finestra su un TESTO DIVERSO — due pagine leggibili una sopra
  // l'altra. Il fondo di carta chiude le fessure.
  if (r > 0) {
    const bandaX = next ? P + c : P - c - r;
    ctx.fillStyle = paper;
    ctx.fillRect(bandaX, 0, r + passo, Hc);
  }

  // parte piatta ancora a terra: il fronte fermo, identico al vero sotto.
  // La mappa e' l'identita', quindi un SOLO blit invece di centinaia di
  // colonne da 2px
  const piatto = Math.min(c, P);
  if (piatto > 0) {
    if (next) ctx.drawImage(oldImg, P * sc, 0, piatto * sc, Hc * sc, P, 0, piatto, Hc);
    else ctx.drawImage(oldImg, (P - piatto) * sc, 0, piatto * sc, Hc * sc, P - piatto, 0, piatto, Hc);
  }

  // l'arco: colonne compresse dal coseno; oltre mezzo giro si vede il retro
  for (let s = c; s < Math.min(P, c + arc); s += passo) {
    const a = (s - c) / r;
    const d = c + r * Math.sin(a);
    const comp = Math.max(0.12, Math.abs(Math.cos(a)));
    // +0.6: le colonne si sovrappongono appena invece di lasciare fessure
    const larg = Math.max(1, passo * comp) + 0.6;
    const x = destX(d);
    // Ombreggiatura da cilindro: la faccia illuminata e' quella che guarda
    // il lettore (a=0), e si spegne mano a mano che la carta si mette di
    // taglio. E' questa scala di grigi che fa vedere la piega: senza, il
    // testo compresso sembra solo sbavato.
    if (a <= Math.PI / 2) {
      ctx.drawImage(oldImg, fronteSrc(s) * sc, 0, passo * sc, Hc * sc, x, 0, larg, Hc);
      // Oltre una certa inclinazione il testo si PERDE nella carta invece
      // di sbavare: compresso all'88% la scritta diventa un codice a
      // barre, e a schermo si legge come pagina sporca o trasparente. Una
      // carta che si volta, vista di taglio, non mostra le sue parole.
      if (comp < 0.5) {
        ctx.globalAlpha = 1 - comp / 0.5;
        ctx.fillStyle = paper;
        ctx.fillRect(x, 0, larg, Hc);
        ctx.globalAlpha = 1;
      }
      const su = Math.sin(a);
      if (su < 0.45) {
        ctx.fillStyle = `rgba(255,250,235,${0.2 * (1 - su / 0.45)})`;
        ctx.fillRect(x, 0, larg, Hc);
      }
      ctx.fillStyle = `rgba(0,0,0,${0.3 * su * su})`;
      ctx.fillRect(x, 0, larg, Hc);
    } else if (newImg) {
      // il retro, visto di sbieco oltre il crinale: in penombra, e si
      // schiarisce distendendosi sulla pagina
      ctx.drawImage(newImg, retroSrc(s) * sc, 0, passo * sc, Hc * sc, x, 0, larg, Hc);
      if (comp < 0.5) {
        ctx.globalAlpha = 1 - comp / 0.5;
        ctx.fillStyle = paper;
        ctx.fillRect(x, 0, larg, Hc);
        ctx.globalAlpha = 1;
      }
      const giu = Math.sin(a);
      ctx.fillStyle = `rgba(0,0,0,${0.24 * giu * giu})`;
      ctx.fillRect(x, 0, larg, Hc);
    } else {
      retroNudo(x, larg);
      ctx.fillStyle = `rgba(0,0,0,${0.24 * Math.sin(a) ** 2})`;
      ctx.fillRect(x, 0, larg, Hc);
    }
  }

  // oltre l'arco il foglio e' di nuovo piatto, a faccia in giu': il retro
  // atterra sull'altra meta' e la copre passo passo
  let orloPosato = null;
  for (let s = c + arc; s < P; s += passo) {
    const d = c - (s - (c + arc));
    const x = destX(d);
    if (x < -passo || x > Wc) continue;
    if (orloPosato === null) orloPosato = x;
    if (newImg) ctx.drawImage(newImg, retroSrc(s) * sc, 0, passo * sc, Hc * sc, x, 0, passo, Hc);
    else retroNudo(x, passo);
  }

  // IL FOGLIO POSATO E' UN FOGLIO, non una finestra sulla pagina sotto.
  // Senza ombreggiatura era dipinto nello stesso identico tono di cio' che
  // ha accanto, e l'occhio leggeva due pagine trasparenti l'una sull'altra
  // invece di una carta appoggiata sopra. Serve un velo che si spegne
  // atterrando (a fine giro dev'essere identico alla pagina vera) e un
  // orlo netto dove la carta finisce.
  const respiro = Math.sin(Math.PI * te);
  if (orloPosato !== null && respiro > 0.01) {
    const fine = next ? P + c : P - c;
    const larg = Math.abs(fine - orloPosato);
    if (larg > 1) {
      const da = next ? orloPosato : fine;
      const v = ctx.createLinearGradient(next ? fine : da, 0, next ? da : fine, 0);
      v.addColorStop(0, `rgba(0,0,0,${0.26 * respiro})`);
      v.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = v;
      ctx.fillRect(Math.min(da, fine), 0, larg, Hc);
      // l'ombra che il foglio posato getta sulla pagina davanti a se'
      const o = next
        ? ctx.createLinearGradient(orloPosato, 0, orloPosato - 40, 0)
        : ctx.createLinearGradient(orloPosato + passo, 0, orloPosato + passo + 40, 0);
      o.addColorStop(0, `rgba(0,0,0,${0.3 * respiro})`);
      o.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = o;
      ctx.fillRect(next ? orloPosato - 40 : orloPosato + passo, 0, 40, Hc);
      // l'orlo vero e proprio: una riga sottile, quel tanto che basta a
      // dire dove finisce la carta
      ctx.fillStyle = `rgba(0,0,0,${0.34 * respiro})`;
      ctx.fillRect(next ? orloPosato : orloPosato + passo - 1, 0, 1, Hc);
    }
  }

  // ombra del foglio sollevato sulla meta' che sta per essere coperta
  const coperto = c + arc >= P ? c - (P - (c + arc)) : c;
  const solleva = Math.min(P, Math.max(0, coperto));
  const g2 = next
    ? ctx.createLinearGradient(P - 0, 0, P - 60, 0)
    : ctx.createLinearGradient(P + 0, 0, P + 60, 0);
  g2.addColorStop(0, `rgba(0,0,0,${0.1 * Math.sin(Math.PI * te)})`);
  g2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  if (next) ctx.fillRect(P - 60, 0, 60, Hc);
  else ctx.fillRect(P, 0, 60, Hc);
  void solleva;
}
