// 旅行手帳離線快取: 同源檔案用 network-first(有網路就拿最新版, 沒網路才用快取), 匯率API等外部請求不攔
const CACHE = "travel-v9";
const ROOT = new URL("./", self.location).href;
const ASSETS = ["./", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "sync.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("travel-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(ROOT)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match(ROOT)))
  );
});
