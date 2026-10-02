// LA TAVOLA COME LA VEDE L'ORACOLO (`lib/oracoloFumetti.js`): rimpicciolita
// al lato che serve, in JPEG, e per «Chi è costui?» col cerchio rosso dove
// il lettore ha toccato. Si fa su una tela solo quando il lettore chiede:
// la regola «niente canvas» delle voltate vale per la voltata, che deve
// stare sotto il fotogramma; qui si aspetta comunque la rete.
export async function tavolaInBase64(blob, { lato = 1400, cerchio = null } = {}) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, lato / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const g = tela.getContext("2d");
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  if (cerchio) {
    const raggio = Math.max(w, h) * 0.07;
    g.lineWidth = Math.max(4, Math.round(Math.max(w, h) / 160));
    g.strokeStyle = "#ff1f1f";
    g.beginPath();
    g.arc(cerchio.x * w, cerchio.y * h, raggio, 0, 2 * Math.PI);
    g.stroke();
  }
  const url = tela.toDataURL("image/jpeg", 0.85);
  return { dati: url.slice(url.indexOf(",") + 1), media: "image/jpeg", w, h };
}
