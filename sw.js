// 旅行手帳離線快取
// 1. 自己的檔案: network-first(有網路拿最新, 沒網路用快取)
// 2. 地圖底圖、Leaflet、收據辨識程式: cache-first(看過的地圖區域離線也能看)
const CACHE = "travel-v11";
const LIB = "travel-lib-v1";
const TILES = "travel-tiles-v1";
const MAX_TILES = 3000;
const ROOT = new URL("./", self.location).href;
const ASSETS = ["./", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "sync.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("travel-") && ![CACHE, LIB, TILES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES), ks = await c.keys();
  if (ks.length > MAX_TILES) await Promise.all(ks.slice(0, ks.length - MAX_TILES + 300).map((k) => c.delete(k)));
}
let putCount = 0;
async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { c.put(req, res.clone()); if (name === TILES && ++putCount % 100 === 0) trimTiles(); }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = req.url;
  if (u.startsWith("https://tile.openstreetmap.org/")) return e.respondWith(cacheFirst(req, TILES));
  if (u.startsWith("https://cdnjs.cloudflare.com/ajax/libs/leaflet/") || u.startsWith("https://cdn.jsdelivr.net/npm/tesseract") || u.startsWith("https://cdn.jsdelivr.net/npm/@tesseract.js-data/"))
    return e.respondWith(cacheFirst(req, LIB));
  if (!u.startsWith(ROOT)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match(ROOT)))
  );
});
