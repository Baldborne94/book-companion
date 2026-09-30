// La funzione di Vercel che rinnova la chiave di Google Drive: la logica e
// le sue ragioni stanno in `src/lib/rinnovoGoogle.js`. Il segreto del client
// (`GOOGLE_CLIENT_SECRET`) sta solo nelle variabili d'ambiente di Vercel.
import { rinnovaChiave } from "../src/lib/rinnovoGoogle.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ motivo: "metodo" });
    return;
  }
  const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { stato, corpo } = await rinnovaChiave({ jwt, env: process.env });
  res.status(stato).json(corpo);
}
