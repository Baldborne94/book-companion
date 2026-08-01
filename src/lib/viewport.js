import { useEffect, useState } from "react";

// Due misure indipendenti, ognuna per il difetto che risolve: l'altezza
// decide se comprimere l'intestazione (tablet in orizzontale), la larghezza
// se affiancare le colonne. Con l'ascolto del ridimensionamento la
// rotazione del tablet cambia forma subito, senza riaprire l'app.
const read = () => ({
  wide: window.innerWidth >= 1100,
  tall: window.innerHeight >= 820,
});

export function useViewport() {
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => {
      const next = read();
      setV((prev) => (prev.wide === next.wide && prev.tall === next.tall ? prev : next));
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
