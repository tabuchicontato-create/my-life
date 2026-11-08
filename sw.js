// Service worker do MY LIFE: guarda só os arquivos do app (nunca dados) para abrir mais rápido.
// Sempre tenta a versão mais nova na rede primeiro.
const CACHE = "mylife-v1.4.0";
const ARQUIVOS = ["./", "index.html", "css/app.css", "manifest.webmanifest", "icones/icone.svg", "icones/icone-192.png",
  "js/app.js", "js/config.js", "js/cripto.js", "js/nuvem.js", "js/dados.js", "js/util.js", "js/telas.js", "js/assistente.js", "js/google.js", "js/ollama.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // "no-cache": sempre confere com o servidor se o arquivo mudou (o GitHub Pages manda guardar por 10 min).
  const rede = e.request.mode === "navigate" ? fetch(e.request) : fetch(e.request, { cache: "no-cache" });
  e.respondWith(rede.then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
