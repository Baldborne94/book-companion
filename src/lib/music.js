const FAVS_KEY = "bc_music_favs";

export function parseYouTube(input) {
  try {
    const u = new URL(input.trim());
    if (!/(^|\.)((youtube(-nocookie)?\.com)|(youtu\.be))$/.test(u.hostname)) return null;
    const list = u.searchParams.get("list");
    let video = u.searchParams.get("v");
    if (!video && u.hostname === "youtu.be") video = u.pathname.slice(1).split("/")[0] || null;
    if (!video) {
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) video = m[2];
    }
    if (list) return { kind: "playlist", list, video: video || null };
    if (video) return { kind: "video", video };
    return null;
  } catch {
    return null;
  }
}

export function embedUrl(src) {
  const base = "https://www.youtube-nocookie.com/embed/";
  const params = "autoplay=1&enablejsapi=1&rel=0";
  if (src.kind === "playlist")
    return `${base}${src.video || "videoseries"}?list=${src.list}&${params}`;
  return `${base}${src.video}?${params}`;
}

export function getFavorites() {
  try {
    const v = JSON.parse(localStorage.getItem(FAVS_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveFavorites(list) {
  localStorage.setItem(FAVS_KEY, JSON.stringify(list));
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}

export function getBookMusic(bookId) {
  try {
    return JSON.parse(localStorage.getItem(`bc_music_${bookId}`)) || null;
  } catch {
    return null;
  }
}

export function setBookMusic(bookId, pair) {
  localStorage.setItem(`bc_music_${bookId}`, JSON.stringify(pair));
  localStorage.setItem(`bc_upd_${bookId}`, String(Date.now()));
}
