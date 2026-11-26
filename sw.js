const CACHE_NAME = "booknest-v4-cache";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./books.html",
  "./book.html",
  "./club.html",
  "./contact.html",
  "./admin.html",
  "./css/style.css",
  "./js/main.js",
  "./js/data.js",
  "./js/ui.js",
  "./js/cart-checkout.js",
  "./js/advanced-features.js",
  "./js/app-core.js",
  "./js/extras-a11y.js",
  "./js/shop-extras.js",
  "./js/user-account.js",
  "./js/admin.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).catch(() => caches.match("./index.html"))
    )
  );
});