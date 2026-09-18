import { useEffect, useState } from "react";
import { C, F, R, px } from "../data/constants.js";

// I TASTI DELLE BARRE DEI READER HANNO UN NOME, DOVE CI STA.
//
// Chiesto dal lettore («c'è modo di rendere più user friendly
// l'applicazione?») dopo sei segnalazioni che dicevano tutte la stessa
// cosa. È la lezione della foglia grigia di «Aspetto» portata dentro il
// libro: **un glifo che riconosci solo se sai già cos'è non è un comando**,
// e la cura non è renderlo più vistoso ma dargli un NOME. Il caso che
// conta è la bussola: 🧭 apre «Dove eravamo rimasti» — il riassunto della
// storia fin dove sei — e non lo indovina nessuno.
//
// **LA BARRA PUÒ CRESCERE PERCHÉ COPRE, NON RESTRINGE** (`position:
// absolute`, `zIndex: 25`): la pagina si impagina su `HEAD`/`FOOT`, 8px,
// che non si toccano mai. Una barra più alta non reimpagina un bel niente
// — copre un po' di più **solo mentre è aperta**, e mentre è aperta non
// stai leggendo: stai cercando un comando. È il momento esatto in cui le
// parole servono e il prezzo è zero. Misurato: 57 → 69px, dodici pixel.
//
// **STA IN UN FILE SOLO** perché i due reader hanno due barre gemelle: una
// cura scritta due volte diverge, e si finisce con metà app curata. (I due
// `barBtn` locali erano già identici: questo è il terzo, e l'ultimo.)
export const SOGLIA_NOMI = 720;

// Quanto ci vuole perché le parole ci stiano. Sotto, restano i soli glifi:
// la barra tiene anche il titolo e i comandi della musica, e più stretta di
// così le parole manderebbero tutto a capo — una barra alta due righe
// copre mezza pagina, e il rimedio sarebbe peggio del difetto.
//
// **È UNA LARGHEZZA, NON UN ORIENTAMENTO**: la domanda è «ci stanno», e
// quella la risponde solo la larghezza. Misurato in Chromium sulla barra
// vera, con un libro aperto: a 720 le parole stanno su una riga sola e al
// titolo restano 206px; a 700 spariscono e la barra torna 57.
export function useNomiNeiTasti() {
  const [ci, setCi] = useState(() => window.innerWidth >= SOGLIA_NOMI);
  useEffect(() => {
    const guarda = () => setCi(window.innerWidth >= SOGLIA_NOMI);
    window.addEventListener("resize", guarda);
    window.addEventListener("orientationchange", guarda);
    return () => {
      window.removeEventListener("resize", guarda);
      window.removeEventListener("orientationchange", guarda);
    };
  }, []);
  return ci;
}

export const barBtn = (active) => ({
  width: px(40),
  height: px(40),
  borderRadius: R.piccolo,
  fontSize: F.titoletto,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: active ? C.accent : C.text,
  background: active ? `${C.accent}1a` : "transparent",
});

// **I NOMI SONO QUELLI DEI PANNELLI CHE APRONO**, non nomi nuovi: due
// parole diverse per la stessa cosa nella stessa schermata si leggono come
// due cose diverse (la regola delle parole degli stati in `ripiani.js`).
// Un tasto senza `nome` non esiste: `aria-label` lo legge comunque, e un
// comando senza nome è il difetto da cui tutto questo nasce.
export default function TastoBarra({ nome, conNome, attivo = false, glifo, stile, ...resto }) {
  const base = barBtn(attivo);
  return (
    <button
      aria-label={nome}
      {...resto}
      style={{
        ...base,
        ...(conNome
          ? {
              width: "auto",
              minWidth: px(46),
              height: px(52),
              padding: "0 7px",
              flexDirection: "column",
              justifyContent: "center",
              gap: 2,
            }
          : null),
        ...stile,
      }}
    >
      <span
        style={{
          fontSize: stile?.fontSize || base.fontSize,
          lineHeight: 1,
          ...(stile?.fontFamily ? { fontFamily: stile.fontFamily } : null),
        }}
      >
        {glifo}
      </span>
      {conNome && (
        <span
          style={{
            fontSize: F.minuscolo,
            lineHeight: 1,
            color: attivo ? C.accent : C.muted,
            whiteSpace: "nowrap",
          }}
        >
          {nome}
        </span>
      )}
    </button>
  );
}
