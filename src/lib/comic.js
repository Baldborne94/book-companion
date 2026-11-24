const IMG = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", bmp: "image/bmp" };

const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

// Le pagine si ordinano per percorso con i numeri "naturali": negli archivi
// reali "p2" e "p10" convivono senza zeri davanti.
export async function openCbz(blob) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(blob);
  const names = Object.values(zip.files)
    .filter((f) => !f.dir && IMG.test(f.name) && !/(^|\/)(__MACOSX|\.)/.test(f.name))
    .map((f) => f.name)
    .sort(naturalSort);
  return {
    pages: names,
    async page(i) {
      const name = names[i];
      if (!name) return null;
      const data = await zip.file(name).async("uint8array");
      const ext = name.split(".").pop().toLowerCase();
      return new Blob([data], { type: MIME[ext] || "image/jpeg" });
    },
  };
}

export async function cbzCover(blob) {
  const c = await openCbz(blob);
  return c.pages.length ? c.page(0) : null;
}
