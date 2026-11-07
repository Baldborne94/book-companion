import { useEffect, useState } from "react";
import { C, F } from "../data/constants.js";
import { daCercare, fraseSerie } from "../lib/novita.js";
import { cercaSerie } from "../lib/serieWikidata.js";

const prendi = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout?.(20000) });
  if (!r.ok) throw new Error(`Wikidata ${r.status}`);
  return r.json();
};

// LA SAGA SEGUITA SU WIKIDATA (`lib/serieWikidata.js`): aperta la raccolta,
// se si segue e non e' ancora stata cercata, la si cerca una volta, e la
// riga dice cosa si guarda.
export default function SerieDellaRaccolta({ r, lista = [], onCercata }) {
  const voce = (lista || []).find((x) => x.id === r?.id) || null;
  const [cerco, setCerco] = useState(false);
  const [guasto, setGuasto] = useState(false);
  const cercare = daCercare(voce);
  useEffect(() => {
    if (!cercare) return undefined;
    let vivo = true;
    setCerco(true);
    setGuasto(false);
    cercaSerie({ nome: r.nome, libri: r.libri }, prendi)
      .then((serie) => vivo && onCercata?.(r.id, serie || []))
      .catch(() => vivo && setGuasto(true))
      .finally(() => vivo && setCerco(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id, cercare]);
  const frase = fraseSerie(voce, { cerco, guasto });
  if (!frase) return null;
  return <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45, margin: "0 0 12px" }}>{frase}</p>;
}
