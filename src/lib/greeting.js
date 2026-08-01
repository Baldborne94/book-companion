// Il saluto compare nell'intestazione compatta o nel riquadro di benvenuto,
// mai in entrambi: sta qui perche' le due strade dicano la stessa cosa.
export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Ancora sveglio";
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}
