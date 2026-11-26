import { books as fallbackBooks } from "./data.js";
import { createBookCard, formatPrice, showToast } from "./ui.js";
import { ShopManager, validateCheckoutFields } from "./cart-checkout.js";
import {
  debounce,
  throttle,
  loadBooksFromJson,
  initBookDetailPage,
  initOpenLibrarySearch
} from "./advanced-features.js";
import { initSpaRouter } from "./app-core.js";
import {
  initLanguageSwitcher,
  initAccessibilityHelpers,
  initDragAndDropToCart,
  initSalesChart
} from "./extras-a11y.js";
import {
  initWishlistFilter,
  initStorageTools,
  runQuickSelfChecks
} from "./shop-extras.js";
import { UserAccountManager } from "./user-account.js";
import { getCustomBooks, initAdminPage } from "./admin.js";
import { initCartAndLikes } from "./cart-and-like-fix.js";

let catalogBooks = [...getCustomBooks(), ...fallbackBooks];
const shop = new ShopManager();
const userAccount = new UserAccountManager();
let triggerCatalogRender = null;

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

function syncActiveNavLink() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1] || "index.html";
  const currentFile = lastPart.includes(".") ? lastPart : "index.html";
  const links = document.querySelectorAll(".nav-list a");

  links.forEach((link) => {
    const hrefParts = (link.getAttribute("href") || "").split("/").filter(Boolean);
    const hrefFile = hrefParts[hrefParts.length - 1] || "index.html";
    const isCurrent = hrefFile === currentFile;

    link.classList.toggle("active", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function initThemeToggle() {
  const toggleBtn = document.querySelector(".theme-toggle");
  const savedTheme = localStorage.getItem("booknest-theme");

  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
  }

  const updateIcon = () => {
    if (!toggleBtn) return;
    const isDark = document.documentElement.classList.contains("dark");
    toggleBtn.textContent = isDark ? "☀️" : "🌙";
    toggleBtn.setAttribute("aria-label", isDark ? "Ашық тақырып" : "Қараңғы тақырып");
  };

  updateIcon();

  toggleBtn?.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const isDark = document.documentElement.classList.contains("dark");
    localStorage.setItem("booknest-theme", isDark ? "dark" : "light");
    updateIcon();
  });
}

function initBurgerMenu() {
  const burgerBtn = document.querySelector(".burger-btn");
  const navMenu = document.querySelector(".nav-menu");
  if (!burgerBtn || !navMenu) return;

  const closeMenu = () => {
    navMenu.classList.remove("is-open");
    burgerBtn.setAttribute("aria-expanded", "false");
  };

  burgerBtn.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    burgerBtn.setAttribute("aria-expanded", String(isOpen));
  });

  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navMenu.classList.contains("is-open")) {
      closeMenu();
      burgerBtn.focus();
    }
  });
}

function initCatalog() {
  const grid = document.querySelector("#books-grid");
  if (!grid) return;

  const isFeaturedOnly = grid.dataset.featured === "true";
  const searchInput = document.querySelector("#search-input");
  const genreChipsContainer = document.querySelector("#genre-chips");
  const sortSelect = document.querySelector("#sort-select");
  const resultsCount = document.querySelector("#results-count");
  const emptyState = document.querySelector("#empty-state");
  const resetFiltersBtn = document.querySelector("#reset-filters-btn");
  const statusBox = document.querySelector("#catalog-status");
  const loadMoreSentinel = document.querySelector("#load-more-sentinel");

  let searchQuery = "";
  let selectedGenre = "Барлығы";
  let sortBy = "default";
  const PAGE_SIZE = 6;
  let visibleCount = PAGE_SIZE;

  function buildChips() {
    if (!genreChipsContainer) return;
    const genres = ["Барлығы", ...new Set(catalogBooks.map((b) => b.genre))];
    genreChipsContainer.innerHTML = genres
      .map(
        (genre) =>
          `<button type="button" class="chip ${genre === selectedGenre ? "is-active" : ""}" data-genre="${genre}">${genre}</button>`
      )
      .join("");
  }

  buildChips();

  genreChipsContainer?.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    selectedGenre = btn.dataset.genre;
    visibleCount = PAGE_SIZE;
    genreChipsContainer.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    renderBooks();
  });

  const applyWishlistFilter = initWishlistFilter(
    shop,
    () => catalogBooks,
    () => {
      visibleCount = PAGE_SIZE;
      renderBooks();
    }
  );

  function renderBooks() {
    let list = isFeaturedOnly ? catalogBooks.slice(0, 4) : [...catalogBooks];

    if (!isFeaturedOnly) {
      if (typeof applyWishlistFilter === "function") {
        list = applyWishlistFilter(list);
      }

      if (selectedGenre !== "Барлығы") {
        list = list.filter((b) => b.genre === selectedGenre);
      }

      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        list = list.filter(
          (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
        );
      }

      if (sortBy === "price-asc") list.sort((a, b) => a.price - b.price);
      if (sortBy === "price-desc") list.sort((a, b) => b.price - a.price);
      if (sortBy === "rating-desc") list.sort((a, b) => b.rating - a.rating);
    }

    grid.innerHTML = "";

    if (resultsCount) {
      resultsCount.textContent = `${list.length} кітап табылды`;
    }

    if (list.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;
    const sliceToShow = isFeaturedOnly ? list : list.slice(0, visibleCount);
    sliceToShow.forEach((book) => {
      const card = createBookCard(book);
      card.setAttribute("draggable", "true");
      grid.appendChild(card);
    });
  }

  triggerCatalogRender = renderBooks;

  if (!isFeaturedOnly && loadMoreSentinel) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          visibleCount += PAGE_SIZE;
          renderBooks();
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(loadMoreSentinel);
  }

  const handleDebouncedSearch = debounce((val) => {
    searchQuery = val;
    visibleCount = PAGE_SIZE;
    renderBooks();
  }, 250);

  searchInput?.addEventListener("input", (e) => {
    handleDebouncedSearch(e.target.value);
  });

  sortSelect?.addEventListener("change", (e) => {
    sortBy = e.target.value;
    visibleCount = PAGE_SIZE;
    renderBooks();
  });

  resetFiltersBtn?.addEventListener("click", () => {
    searchQuery = "";
    selectedGenre = "Барлығы";
    sortBy = "default";
    visibleCount = PAGE_SIZE;
    if (searchInput) searchInput.value = "";
    if (sortSelect) sortSelect.value = "default";
    buildChips();
    renderBooks();
  });

  renderBooks();
  initSalesChart(catalogBooks);

  const fetchBooks = async () => {
    const loaded = await loadBooksFromJson(statusBox, fetchBooks);
    if (loaded) {
      catalogBooks = [...getCustomBooks(), ...loaded];
      buildChips();
      renderBooks();
      initSalesChart(catalogBooks);
    }
  };
  fetchBooks();
}

function initBookModal() {
  const modal = document.querySelector("#book-modal");
  if (!modal) return;

  const modalBody = modal.querySelector("#modal-body");
  const closeBtn = modal.querySelector(".modal-close");
  let lastFocusedElement = null;

  function openModal(book) {
    lastFocusedElement = document.activeElement;
    modalBody.innerHTML = `
      <div class="modal-book">
        <img src="${book.cover}" alt="${book.title}" width="200" height="280">
        <div>
          <span class="modal-genre">${book.genre} · ${book.year} ж.</span>
          <h2 id="modal-title">${book.title}</h2>
          <p class="author">Авторы: <strong>${book.author}</strong></p>
          <p class="rating">${Number(book.rating).toFixed(1)} / 5.0</p>
          <p class="modal-desc">${book.description}</p>
          <p class="price">${formatPrice(book.price)}</p>
          <div class="card-actions">
            <button type="button" class="btn" data-add-cart="${book.id}">Себетке қосу</button>
            <a href="book.html?id=${book.id}" class="btn-outline">Толық бет</a>
          </div>
        </div>
      </div>
    `;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    lastFocusedElement?.focus();
  }

  document.addEventListener("click", (e) => {
    if (
      e.target.closest("[data-add-cart]") ||
      e.target.closest("[data-wish-btn]") ||
      e.target.closest(".card-link")
    ) {
      return;
    }
    const card = e.target.closest(".card[data-id]");
    if (card) {
      const book = catalogBooks.find((b) => b.id === Number(card.dataset.id));
      if (book) openModal(book);
    }
  });

  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
}

function initShopExtrasOnly() {
  initStorageTools(shop);
  document.querySelector("#run-self-checks-btn")?.addEventListener("click", () => {
    runQuickSelfChecks(shop);
  });
  initDragAndDropToCart((bookId) => shop.addToCart(bookId, 1));
}

function initContactForm() {
  const form = document.querySelector("#contact-form");
  if (!form) return;

  const nameInput = form.querySelector("#name");
  const emailInput = form.querySelector("#email");
  const messageInput = form.querySelector("#message");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, message) {
    const errorEl = form.querySelector(`#${input.id}-error`);
    if (errorEl) errorEl.textContent = message;
    input.classList.toggle("is-invalid", Boolean(message));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let isValid = true;

    if (nameInput.value.trim() === "") {
      setError(nameInput, "Аты-жөніңізді енгізіңіз.");
      isValid = false;
    } else {
      setError(nameInput, "");
    }

    if (!emailRegex.test(emailInput.value.trim())) {
      setError(emailInput, "Дұрыс email мекенжайын енгізіңіз.");
      isValid = false;
    } else {
      setError(emailInput, "");
    }

    if (messageInput.value.trim().length < 10) {
      setError(messageInput, "Хабарлама кемінде 10 таңбадан тұруы керек.");
      isValid = false;
    } else {
      setError(messageInput, "");
    }

    if (isValid) {
      form.reset();
      showToast("Хабарламаңыз сәтті жіберілді!");
    }
  });
}

function initFaqAccordion() {
  const faqItems = document.querySelectorAll(".faq-item");
  if (!faqItems.length) return;

  faqItems.forEach((item) => {
    const btn = item.querySelector(".faq-question");
    btn?.addEventListener("click", () => {
      const isAlreadyOpen = item.classList.contains("is-open");

      faqItems.forEach((other) => {
        other.classList.remove("is-open");
        other.querySelector(".faq-question")?.setAttribute("aria-expanded", "false");
      });

      if (!isAlreadyOpen) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function initHeroSlider() {
  const slider = document.querySelector(".hero-slider");
  if (!slider) return;

  const slides = slider.querySelectorAll(".slide");
  const dots = slider.querySelectorAll(".slider-dot");
  const prevBtn = slider.querySelector(".slider-prev");
  const nextBtn = slider.querySelector(".slider-next");
  let current = 0;
  let intervalId = null;

  function showSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("is-active", i === current));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
  }

  function startAutoPlay() {
    stopAutoPlay();
    intervalId = setInterval(() => showSlide(current + 1), 4500);
  }

  function stopAutoPlay() {
    if (intervalId) clearInterval(intervalId);
  }

  prevBtn?.addEventListener("click", () => showSlide(current - 1));
  nextBtn?.addEventListener("click", () => showSlide(current + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => showSlide(i)));

  slider.addEventListener("mouseenter", stopAutoPlay);
  slider.addEventListener("mouseleave", startAutoPlay);

  startAutoPlay();
}

function initStatsCounter() {
  const statsSection = document.querySelector(".stats-section");
  if (!statsSection) return;

  const counters = statsSection.querySelectorAll(".stat-number");
  let started = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !started) {
        started = true;
        counters.forEach((counter) => {
          const target = Number(counter.dataset.target);
          const suffix = counter.dataset.suffix || "";
          const duration = 1200;
          const stepTime = 20;
          const steps = duration / stepTime;
          const increment = target / steps;
          let current = 0;

          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              counter.textContent = target + suffix;
              clearInterval(timer);
            } else {
              counter.textContent = Math.floor(current) + suffix;
            }
          }, stepTime);
        });
        observer.disconnect();
      }
    },
    { threshold: 0.3 }
  );

  observer.observe(statsSection);
}

function initScrollReveal() {
  const revealEls = document.querySelectorAll(".reveal");
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealEls.forEach((el) => observer.observe(el));
}

function initBackToTop() {
  const btn = document.querySelector("#back-to-top");
  if (!btn) return;

  const onScroll = throttle(() => {
    btn.classList.toggle("is-visible", window.scrollY > 300);
  }, 150);

  window.addEventListener("scroll", onScroll);

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function bootAll() {
  syncActiveNavLink();
  initAccessibilityHelpers();
  initLanguageSwitcher();
  initThemeToggle();
  initBurgerMenu();
  initCatalog();
  initBookModal();
  initShopExtrasOnly();
  initContactForm();
  initFaqAccordion();
  initHeroSlider();
  initStatsCounter();
  initScrollReveal();
  initBackToTop();
  initOpenLibrarySearch();
  userAccount.renderAccountWidget();
  initAdminPage(fallbackBooks);

  if (document.body.dataset.page === "book-detail") {
    loadBooksFromJson(null).then((loaded) => {
      initBookDetailPage(loaded || fallbackBooks);
    });
  }
}

registerServiceWorker();
initSpaRouter();
initCartAndLikes();
window.addEventListener("popstate", syncActiveNavLink);
document.addEventListener("booknest:route-loaded", bootAll);
bootAll();