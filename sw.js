// Miff : met l'appli en cache pour qu'elle s'ouvre vite, même avec un mauvais réseau.
// Les documents et les données de la famille ne sont jamais mis en cache.
const CACHE = "miff-v4";
const BASE = new URL("./", self.location).pathname; // "/" sur le NAS, "/miff-demo/" sur GitHub Pages
const SHELL = ["", "css/app.css", "js/app.js", "js/api.js", "js/ui.js", "js/tree.js", "js/scanner.js",
  "js/views.js", "fonts/plus-jakarta-sans.woff2", "icons/icon-192.png", "manifest.webmanifest"].map((p) => BASE + p);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith(BASE + "api/")) return;
  // Réseau d'abord (pour avoir toujours la dernière version), cache si le NAS ne répond pas.
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && (SHELL.includes(url.pathname) || url.pathname.startsWith(BASE + "js/") || url.pathname.startsWith(BASE + "css/"))) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match(BASE)))
  );
});
