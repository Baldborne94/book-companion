# I CBR DI GOOGLE DRIVE IN CBZ, DENTRO GOOGLE (il quaderno `cbr-in-cbz.ipynb`
# lo lancia su Colab). Convertire dall'app vuol dire scaricare ogni volume e
# RICARICARLO dalla connessione di casa, che in salita va piano: su Colab
# Drive si legge e si scrive alla velocita' dei server di Google.
#
# Per ogni .cbr sotto la cartella scelta nasce accanto un .cbz con lo stesso
# nome, e le pagine dentro si chiamano come nel RAR: stesso ordine, stesso
# segno di lettura. Il CBR non si tocca: e' l'app, al giro dopo, a
# riconoscere il gemello (`cbzDaAdottare`), riattaccarlo al libro e mandare
# il CBR nel cestino di Drive.
import os
import pathlib
import shutil
import subprocess
import time
import zipfile

RAR = b"Rar!\x1a\x07"


def e_rar(p):
    with open(p, "rb") as f:
        return f.read(6) == RAR


def estrai(archivio, dove):
    # unrar se c'e', altrimenti bsdtar (libarchive legge anche RAR 5)
    if shutil.which("unrar"):
        comando = ["unrar", "x", "-o+", "-inul", str(archivio), str(dove) + "/"]
    else:
        comando = ["bsdtar", "-xf", str(archivio), "-C", str(dove)]
    subprocess.run(comando, check=True)


def comprimi(dove, zip_path):
    # memorizzato, non compresso: le pagine sono gia' JPG e PNG, e un CBZ
    # memorizzato l'app lo legge a pezzi senza sciogliere niente
    nomi = sorted(p for p in pathlib.Path(dove).rglob("*") if p.is_file())
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as z:
        for p in nomi:
            z.write(p, p.relative_to(dove).as_posix())
    return len(nomi)


def trova_cartella(cartella):
    # la cartella dell'app si riconosce senza badare alle maiuscole, come fa
    # l'app (sul Drive del lettore era «Book-Companion», e Colab, che
    # distingue, non trovava niente e diceva «0 file»)
    p = pathlib.Path(cartella)
    if p.is_dir():
        return p
    sopra = p.parent
    if sopra.is_dir():
        for c in sopra.iterdir():
            if c.is_dir() and c.name.lower() == p.name.lower():
                return c
    return None


def converti_tutti(cartella, lavoro="/content/lavoro", dice=print):
    trovata = trova_cartella(cartella)
    if trovata is None:
        sopra = pathlib.Path(cartella).parent
        dentro = sorted(c.name for c in sopra.iterdir() if c.is_dir()) if sopra.is_dir() else []
        dice(f"La cartella {cartella} non c'e'. In {sopra} ci sono: {', '.join(dentro) or 'nessuna cartella'}.")
        dice("Scrivi in CARTELLA quella dell'app e rilancia questa cella.")
        return 0, 0, 0
    cartella = trovata
    cbr = sorted(p for p in pathlib.Path(cartella).rglob("*") if p.is_file() and p.suffix.lower() == ".cbr")
    fatti = saltati = falliti = 0
    dice(f"{len(cbr)} file .cbr sotto {cartella}")
    for i, p in enumerate(cbr, 1):
        dest = p.with_suffix(".cbz")
        if dest.exists():
            saltati += 1
            dice(f"[{i}/{len(cbr)}] {p.name}: il CBZ c'e' gia'")
            continue
        if not e_rar(p):
            saltati += 1
            dice(f"[{i}/{len(cbr)}] {p.name}: e' gia' uno zip col nome sbagliato, l'app lo legge com'e'")
            continue
        t0 = time.time()
        base = pathlib.Path(lavoro)
        shutil.rmtree(base, ignore_errors=True)
        (base / "pagine").mkdir(parents=True)
        try:
            locale = base / "volume.cbr"
            shutil.copyfile(p, locale)
            estrai(locale, base / "pagine")
            pronto = base / "volume.cbz"
            n = comprimi(base / "pagine", pronto)
            if not n:
                raise RuntimeError("nessun file dentro")
            # prima con un altro nome, poi al suo posto: l'app non deve
            # mai vedere un CBZ scritto a meta'
            parziale = dest.with_name(dest.name + ".parziale")
            shutil.copyfile(pronto, parziale)
            os.replace(parziale, dest)
            fatti += 1
            dice(f"[{i}/{len(cbr)}] {p.name}: {n} file, {os.path.getsize(dest) / 2**20:.0f} MB in {time.time() - t0:.0f} s")
        except Exception as e:
            falliti += 1
            dice(f"[{i}/{len(cbr)}] {p.name}: NON convertito ({e})")
        finally:
            shutil.rmtree(base, ignore_errors=True)
    dice(f"Fatto: {fatti} convertiti, {saltati} saltati, {falliti} non riusciti.")
    return fatti, saltati, falliti
