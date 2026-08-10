const KEY = "bc_speed";
// Il passo di un EPUB e quello di un PDF stanno in cassetti diversi: una
// pagina A4 non e' una schermata di libro, e mescolarli sballerebbe
// tutt'e due le stime.
const chiave = (tipo) => (tipo ? `${KEY}_${tipo}` : KEY);
const MIN_TURN = 2500;
const MAX_TURN = 4 * 60 * 1000;
const KEEP = 14;

export function pushSample(samples, dt) {
  if (!(dt >= MIN_TURN && dt <= MAX_TURN)) return samples;
  return [...samples, Math.round(dt)].slice(-KEEP);
}

export function medianMs(samples) {
  if (!samples || samples.length < 4) return null;
  const s = [...samples].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function formatLeft(ms) {
  if (ms < 45000) return "meno di un minuto";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function loadSamples(tipo) {
  try {
    const v = JSON.parse(localStorage.getItem(chiave(tipo)));
    return Array.isArray(v) ? v.filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

export const saveSamples = (samples, tipo) =>
  localStorage.setItem(chiave(tipo), JSON.stringify(samples));
