const CACHE_PREFIX = "booknest_cache_";

// Кэш с временем жизни (TTL в миллисекундах)
export function setCache(key, data, ttlMs = 5 * 60 * 1000) {
  const payload = {
    data,
    expiresAt: Date.now() + ttlMs
  };
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // Игнорируем переполнение хранилища
  }
}

export function getCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

// Единые состояния интерфейса: loading | error | empty | ready
export function renderUiStatus(container, { status, message = "", onRetry = null }) {
  if (!container) return;
  if (status === "ready") {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  if (status === "loading") {
    container.innerHTML = `<div class="status-box status-loading" role="status">Жүктелуде...</div>`;
    return;
  }

  if (status === "empty") {
    container.innerHTML = `<div class="status-box status-empty">${message || "Деректер табылмады."}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="status-box status-error" role="alert">
      <p>${message || "Қате орын алды."}</p>
      ${onRetry ? '<button type="button" class="btn retry-action-btn">Қайталау</button>' : ""}
    </div>
  `;

  if (onRetry) {
    container.querySelector(".retry-action-btn")?.addEventListener("click", onRetry);
  }
}

// Классы доменной модели
export class Book {
  constructor({ id, title, author, genre, year, price, rating, cover, isNew = false, description = "" }) {
    this.id = Number(id);
    this.title = title;
    this.author = author;
    this.genre = genre;
    this.year = Number(year);
    this.price = Number(price);
    this.rating = Number(rating);
    this.cover = cover;
    this.isNew = Boolean(isNew);
    this.description = description;
  }

  formattedPrice() {
    return `${this.price.toLocaleString("kk-KZ")} ₸`;
  }
}

export class Cart {
  constructor(items = []) {
    this.items = Array.isArray(items) ? items.map((i) => ({ bookId: Number(i.bookId), qty: Number(i.qty) || 1 })) : [];
  }

  add(bookId, qty = 1) {
    const id = Number(bookId);
    const existing = this.items.find((i) => i.bookId === id);
    if (existing) {
      existing.qty += qty;
    } else {
      this.items.push({ bookId: id, qty });
    }
  }

  remove(bookId) {
    const id = Number(bookId);
    this.items = this.items.filter((i) => i.bookId !== id);
  }

  totalItems() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  }
}

export class Order {
  constructor({ id, date, total, items = [], status = "Рәсімделді" }) {
    this.id = id || `ORD-${Date.now().toString().slice(-6)}`;
    this.date = date || new Date().toLocaleDateString("kk-KZ");
    this.total = Number(total) || 0;
    this.items = items;
    this.status = status;
  }
}

// Центральный Store с подпиской и CustomEvent
export class Store {
  constructor(initialState = {}) {
    this.state = {
      lang: initialState.lang || "kk",
      uiStatus: initialState.uiStatus || "ready",
      lastEvent: null,
      ...initialState
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(patch, eventName = "state-updated") {
    this.state = { ...this.state, ...patch, lastEvent: eventName };
    this.listeners.forEach((fn) => fn(this.state));
    document.dispatchEvent(
      new CustomEvent("booknest:state-change", {
        detail: { state: this.state, eventName }
      })
    );
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const appStore = new Store();

// SPA-роутер на history.pushState + popstate для внутренних ссылок
export function initSpaRouter() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    if (
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      link.getAttribute("href").startsWith("#") ||
      link.getAttribute("href").startsWith("mailto:") ||
      link.getAttribute("href").startsWith("http")
    ) {
      return;
    }

    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (url.pathname.endsWith("/admin.html") || url.pathname === "/admin") {
  return;
}

    // Если открыт file:// или нужно обычное поведение при отсутствии сервера, не ломаем переход
    if (window.location.protocol === "file:") return;

    e.preventDefault();
    window.history.pushState({ path: url.pathname + url.search }, "", url.pathname + url.search);
    loadRouteContent(url.pathname + url.search);
  });

  window.addEventListener("popstate", () => {
    loadRouteContent(window.location.pathname + window.location.search);
  });
}

async function loadRouteContent(fullPath) {
  try {
    const res = await fetch(fullPath);
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