import { showToast } from "./ui.js";
import { appStore } from "./app-core.js";

const I18N = {
  kk: {
    brand: "BookNest",
    home: "Басты бет",
    catalog: "Каталог",
    club: "Оқу клубы",
    contact: "Байланыс",
    skipLink: "Негізгі мазмұнға өту",
    dropHint: "Кітапты себетке сүйреп апарыңыз"
  },
  ru: {
    brand: "BookNest",
    home: "Главная",
    catalog: "Каталог",
    club: "Клуб чтения",
    contact: "Контакты",
    skipLink: "Перейти к основному содержанию",
    dropHint: "Перетащите книгу в корзину"
  },
  en: {
    brand: "BookNest",
    home: "Home",
    catalog: "Catalog",
    club: "Reading Club",
    contact: "Contact",
    skipLink: "Skip to main content",
    dropHint: "Drag a book to the cart"
  }
};

// Переключатель языка (kk / ru / en)
export function initLanguageSwitcher() {
  const select = document.querySelector("#lang-select");
  const saved = localStorage.getItem("booknest_lang") || "kk";

  const applyLang = (lang) => {
    const dict = I18N[lang] || I18N.kk;
    document.documentElement.lang = lang;
    localStorage.setItem("booknest_lang", lang);
    appStore.setState({ lang }, "language-changed");

    const skip = document.querySelector(".skip-link");
    if (skip) skip.textContent = dict.skipLink;

    const navLinks = document.querySelectorAll(".nav-list a");
    const labels = [dict.home, dict.catalog, dict.club, dict.contact];
    navLinks.forEach((a, idx) => {
      if (labels[idx]) a.textContent = labels[idx];
    });
  };

  if (select) {
    select.value = saved;
    select.addEventListener("change", (e) => applyLang(e.target.value));
  }

  applyLang(saved);
}

// Доступность: skip link, aria-live и ловушка фокуса для модальных окон/drawer
export function initAccessibilityHelpers() {
  if (!document.querySelector(".skip-link")) {
    const skip = document.createElement("a");
    skip.href = "#main-content";
    skip.className = "skip-link";
    skip.textContent = "Негізгі мазмұнға өту";
    document.body.prepend(skip);
  }

  const main = document.querySelector("main");
  if (main && !main.id) {
    main.id = "main-content";
    main.tabIndex = -1;
  }

  if (!document.querySelector("#a11y-live-region")) {
    const live = document.createElement("div");
    live.id = "a11y-live-region";
    live.className = "sr-only";
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const activeDialog = document.querySelector(
      "#book-modal:not([hidden]) .modal-dialog, #cart-drawer:not([hidden]) .drawer-panel"
    );
    if (!activeDialog) return;

    const focusables = activeDialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

// Drag & Drop карточек книг в корзину
export function initDragAndDropToCart(onBookDropped) {
  const dropZone = document.querySelector("#cart-drop-zone");
  if (!dropZone) return;

  document.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    card.setAttribute("draggable", "true");
    e.dataTransfer.setData("text/plain", card.dataset.id);
    dropZone.classList.add("is-drop-ready");
  });

  document.addEventListener("dragend", () => {
    dropZone.classList.remove("is-drop-ready", "is-drag-over");
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("is-drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-drop-ready", "is-drag-over");
    const bookId = e.dataTransfer.getData("text/plain");
    if (bookId && typeof onBookDropped === "function") {
      onBookDropped(Number(bookId));
      showToast("Кітап себетке сүйреліп салынды!");
    }
  });
}

// График продаж по жанрам на <canvas>
export function initSalesChart(booksList = []) {
  const canvas = document.querySelector("#sales-chart-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const totalsByGenre = new Map();

  for (const b of booksList) {
    const prev = totalsByGenre.get(b.genre) || 0;
    totalsByGenre.set(b.genre, prev + Number(b.price || 0));
  }

  const entries = Array.from(totalsByGenre.entries());
  if (!entries.length) return;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const maxVal = Math.max(...entries.map(([, v]) => v), 1);
  const paddingBottom = 36;
  const paddingTop = 24;
  const usableH = height - paddingBottom - paddingTop;
  const barWidth = Math.min(72, Math.floor((width - 40) / entries.length) - 16);
  const gap = 16;

  entries.forEach(([genre, val], idx) => {
    const barH = Math.max(12, Math.round((val / maxVal) * usableH));
    const x = 24 + idx * (barWidth + gap);
    const y = height - paddingBottom - barH;

    ctx.fillStyle = "#2c4a3e";
    ctx.fillRect(x, y, barWidth, barH);

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px sans-serif";
    ctx.fillText(genre, x, height - 12);
  });
}