// I generi da scegliere col dito. Il campo Genere resta una casella di
// testo libera — quello che ci hai scritto tu vale sempre — ma su un
// tablet scrivere «Sword & sorcery» a mano vuol dire aprire la tastiera,
// coprire mezza scheda e sbagliare a metà: qui c'e' l'elenco da toccare.
//
// Le FAMIGLIE sono quelle di prima (Fantasy, Giallo, Thriller, Romanzo…),
// non nomi nuovi: i libri che hai gia' segnato restano nel loro scaffale
// invece di finire in un gruppo tutto loro.
//
// Il sottogenere si scrive attaccato alla famiglia — «Fantasy · Grimdark»
// — e il separatore serve a una cosa sola: in Libreria lo scaffale
// raggruppa per la parte PRIMA del punto. Se il sottogenere fosse il
// valore intero, ogni libro finirebbe in un gruppo da uno e lo scaffale
// «per genere» si sbriciolerebbe — che e' l'opposto di un raggruppamento.

export const SEP = " · ";

export const FAMIGLIE = [
  {
    nome: "Fantasy",
    sotto: ["Epico", "Grimdark", "Urban fantasy", "Sword & sorcery", "Fiabesco", "Romantasy", "Comico", "Portale", "Mitologico"],
  },
  {
    nome: "Fantascienza",
    sotto: ["Space opera", "Cyberpunk", "Distopia", "Ucronia", "Post-apocalittico", "Hard SF", "Viaggi nel tempo", "Primo contatto"],
  },
  {
    nome: "Horror",
    sotto: ["Gotico", "Soprannaturale", "Weird", "Cosmico", "Psicologico", "Splatter", "Vampiri"],
  },
  {
    nome: "Giallo",
    sotto: ["Poliziesco", "Noir", "Hard boiled", "Cozy mystery", "Legal thriller", "Storico"],
  },
  {
    nome: "Thriller",
    sotto: ["Psicologico", "Spionaggio", "Techno-thriller", "Cospirazione", "Legale"],
  },
  {
    nome: "Avventura",
    sotto: ["Cappa e spada", "Mare", "Esplorazione", "Western", "Sopravvivenza"],
  },
  {
    nome: "Storico",
    sotto: ["Antichità", "Medioevo", "Rinascimento", "Ottocento", "Prima guerra mondiale", "Seconda guerra mondiale"],
  },
  {
    nome: "Romanzo",
    sotto: ["Contemporaneo", "Formazione", "Classico", "Racconti", "Satira", "Realismo magico", "Epistolare", "Rosa"],
  },
  {
    nome: "Saggistica",
    sotto: ["Storia", "Scienza", "Filosofia", "Politica", "Arte", "Viaggio", "Economia", "Divulgazione"],
  },
  {
    nome: "Biografia",
    sotto: ["Autobiografia", "Memoir", "Diari", "Lettere"],
  },
  {
    nome: "Poesia",
    sotto: ["Lirica", "Epica", "Teatro"],
  },
  {
    nome: "Fumetti",
    sotto: ["Graphic novel", "Manga", "Supereroi", "Bande dessinée", "Strisce"],
  },
  {
    nome: "Ragazzi",
    sotto: ["Illustrati", "Middle grade", "Young adult"],
  },
  {
    nome: "Manuali",
    sotto: ["Cucina", "Informatica", "Salute", "Hobby", "Fai da te", "Studio"],
  },
];

// Lo scaffale raggruppa per famiglia, non per sottogenere. Un genere
// scritto a mano che non ha separatore e' gia' la sua famiglia.
export function famigliaDi(genere) {
  const g = String(genere || "").trim();
  if (!g) return "";
  const i = g.indexOf(SEP.trim());
  return i < 0 ? g : g.slice(0, i).trim();
}

// Tutte le voci in chiaro, per il suggeritore della casella di testo:
// «Fantasy», «Fantasy · Grimdark», … Chi ha una tastiera continua a
// scrivere e ad avere i suggerimenti di sempre.
export const TUTTI = FAMIGLIE.flatMap((f) => [f.nome, ...f.sotto.map((s) => f.nome + SEP + s)]);
