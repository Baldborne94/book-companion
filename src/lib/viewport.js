import { useEffect, useState } from "react";
import { px } from "../data/constants.js";

// Due misure indipendenti, ognuna per il difetto che risolve: l'altezza
// decide se comprimere l'intestazione (tablet in orizzontale), la larghezza
// se affiancare le colonne. Con l'ascolto del ridimensionamento la
// rotazione del tablet cambia forma subito, senza riaprire l'app.
// `largo`: lo schermo del computer, dove accanto al libro in mano c'e' posto
// per le stanze. Si misura con la scrittura: sul tablet ×1,5 in orizzontale
// (1503) non lo e'
const read = () => ({
  wide: window.innerWidth >= 1100,
  tall: window.innerHeight >= 820,
  largo: window.innerWidth >= px(1180),
});

export function useViewport() {
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => {
      const next = read();
      setV((prev) => (prev.wide === next.wide && prev.tall === next.tall && prev.largo === next.largo ? prev : next));
    };
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return v;
}
