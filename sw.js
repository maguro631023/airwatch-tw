/* 版本號每次改動都要遞增，否則舊版會被鎖在快取裡 */
const VERSION = "airwatch-v6";
const SHELL = ["./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  // API 一律走網路，不快取，避免顯示過期的空品數值
  if (url.hostname.endsWith("moenv.gov.tw") || url.hostname.endsWith("cwa.gov.tw")) return;
  if (req.method !== "GET") return;

  const isShell = req.mode === "navigate" ||
                  url.pathname.endsWith("/") ||
                  url.pathname.endsWith(".html");

  if (isShell) {
    // 主頁改為 network-first：永遠先拿新版，離線時才退回快取
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // 圖示等靜態資源沿用 cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
