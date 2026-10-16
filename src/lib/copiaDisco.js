// LA COPIA DELLA BIBLIOTECA SUL DISCO (chiesto dal lettore fra le proposte).
// I libri stanno sul disco del computer; schede, punti di lettura,
// segnalibri, evidenziazioni e diario stavano solo nel browser e in
// Supabase, e se uno dei due li perde l'altro li ricopia — finche' non li
// perdono tutt'e due, o finche' un giro sbagliato non li sporca in tutt'e
// due. A ogni «Controlla il disco» se ne scrive una copia accanto ai libri:
// uno zip col solo `biblioteca.json`, lo stesso indice di «Esporta
// biblioteca», che «Ripristina» sa gia' leggere.
//
// Una al giorno: la copia di oggi si riscrive (e' nostra, ed e' piu'
// fresca), quelle dei giorni prima restano. Non si cancella niente.
export const COPIE = "_Copie";

export const nomeCopia = (ora = new Date()) => `biblioteca-${ora.toISOString().slice(0, 10)}.zip`;

export async function scriviCopia(casa, { indice, JSZip, ora = new Date() }) {
  const zip = new JSZip();
  zip.file("biblioteca.json", JSON.stringify(indice));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const dir = await casa.getDirectoryHandle(COPIE, { create: true });
  const nome = nomeCopia(ora);
  const fh = await dir.getFileHandle(nome, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  // si rilegge dal disco: una copia scritta a meta' non e' una copia, e
  // dirla fatta sarebbe peggio che dire che non c'e'
  const scritto = await fh.getFile();
  if (scritto.size !== blob.size) throw new Error(`la copia sul disco pesa ${scritto.size} byte invece di ${blob.size}`);
  return { nome, percorso: `${COPIE}/${nome}`, byte: blob.size, schede: indice.books?.length || 0 };
}
