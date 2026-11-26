const STORAGE_PREFIX = "booknest_store_";

export class Store {
  constructor(namespace = "default") {
    this.namespace = namespace;
    this.state = this.load();
    this.listeners = new Set();
  }

  getStorageKey() {
    return `${STORAGE_PREFIX}${this.namespace}`;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.state));
    } catch {
      // Игнорируем ошибки квоты хранилища
    }
  }

  get(key, fallback = null) {
    return Object.prototype.hasOwnProperty.call(this.state, key) ? this.state[key] : fallback;
  }

  set(key, value) {
    this.state[key] = value;
    this.save();
    this.emit(key, value);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(key, value) {
    this.listeners.forEach((fn) => fn(key, value, this.state));
  }
}

export const appStore = new Store("v1");

export function initSpaRouter() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link) return;

    const rawHref = link.getAttribute("href") || "";
    if (
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      link.dataset.noSpa !== undefined ||
      rawHref.startsWith("#") ||
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("http")
    ) {
      return;
    }

    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    // Не перехватываем admin.html, чтобы страница не мигала и не улетала на index.html
    if (url.pathname.endsWith("/admin.html") || url.pathname.endsWith("admin.html")) {
      return;
    }

    if (window.location.protocol === "file:") return;

    e.preventDefault();
    const targetPath = url.pathname + url.search;
    window.history.pushState({ path: targetPath }, "", targetPath);
    loadRouteContent(targetPath);
  });

  window.addEventListener("popstate", () => {
    const path = window.location.pathname + window.location.search;
    if (path.includes("admin.html")) {
      window.location.reload();
      return;
    }
    loadRouteContent(path);
  });
}

async function loadRouteContent(fullPath) {
  try {
    const res = await fetch(fullPath, { cache: "no-store" });
    if (!res.ok) {
      window.location.href = fullPath;
      return;
    }
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const newMain = doc.querySelector("main");
    const currentMain = document.querySelector("main");

    if (newMain && currentMain) {
      currentMain.replaceWith(newMain);
      document.title = doc.title;
      document.dispatchEvent(new CustomEvent("booknest:route-loaded", { detail: { path: fullPath } }));
    } else {
      window.location.href = fullPath;
    }
  } catch {
    window.location.href = fullPath;
  }
}