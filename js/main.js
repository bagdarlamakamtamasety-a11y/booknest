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

let catalogBooks = [...fallbackBooks];
const shop = new ShopManager();

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

  function renderBooks() {
    let list = isFeaturedOnly ? catalogBooks.slice(0, 4) : [...catalogBooks];

    if (!isFeaturedOnly) {
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
      shop.renderAll();
      return;
    }

    if (emptyState) emptyState.hidden = true;
    const sliceToShow = isFeaturedOnly ? list : list.slice(0, visibleCount);
    sliceToShow.forEach((book) => {
      grid.appendChild(createBookCard(book));
    });
    shop.renderAll();
  }

  // 72: IntersectionObserver арқылы келесі бетті жүктеу
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

  // 73: debounce іздеуге
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

  // 74: books.json-нан қайта жүктеу функциясы
  const fetchBooks = async () => {
    const loaded = await loadBooksFromJson(statusBox, fetchBooks);
    if (loaded) {
      catalogBooks = loaded;
      buildChips();
      renderBooks();
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

function initShopInteractions() {
  document.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add-cart]");
    if (addBtn) {
      e.stopPropagation();
      shop.addToCart(addBtn.dataset.addCart, 1);
      return;
    }

    const wishBtn = e.target.closest("[data-wish-btn]");
    if (wishBtn) {
      e.stopPropagation();
      shop.toggleWishlist(wishBtn.dataset.wishBtn);
      return;
    }

    const repeatBtn = e.target.closest(".repeat-order-btn");
    if (repeatBtn) {
      shop.repeatOrder(repeatBtn.dataset.orderId);
    }
  });

  const drawer = document.querySelector("#cart-drawer");
  const openBtns = document.querySelectorAll("[data-open-cart]");
  const closeBtn = drawer?.querySelector(".drawer-close");

  if (drawer) {
    let prevFocused = null;

    const openDrawer = () => {
      prevFocused = document.activeElement;
      drawer.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn?.focus();
      shop.renderAll();
    };

    const closeDrawer = () => {
      drawer.hidden = true;
      document.body.style.overflow = "";
      prevFocused?.focus();
    };

    openBtns.forEach((b) => b.addEventListener("click", openDrawer));
    closeBtn?.addEventListener("click", closeDrawer);

    drawer.addEventListener("click", (e) => {
      if (e.target === drawer) closeDrawer();

      const inc = e.target.closest(".qty-inc");
      const dec = e.target.closest(".qty-dec");
      const rem = e.target.closest(".qty-rem");
      if (inc) shop.updateQty(inc.dataset.id, 1);
      if (dec) shop.updateQty(dec.dataset.id, -1);
      if (rem) shop.removeFromCart(rem.dataset.id);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !drawer.hidden) closeDrawer();
    });

    const promoForm = drawer.querySelector("#promo-form");
    const promoMsg = drawer.querySelector("#promo-message");
    promoForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = promoForm.querySelector("#promo-input");
      const res = shop.applyPromo(input.value);
      if (promoMsg) {
        promoMsg.textContent = res.message;
        promoMsg.style.color = res.ok ? "var(--color-primary)" : "var(--color-error)";
      }
      if (res.ok) input.value = "";
    });

    let step = 1;
    const stepPanels = drawer.querySelectorAll("[data-step-panel]");
    const progressEl = drawer.querySelector("#checkout-progress");
    const errorEl = drawer.querySelector("#checkout-error");
    const phoneInput = drawer.querySelector("#order-phone");
    const addressInput = drawer.querySelector("#order-address");
    const cardInput = drawer.querySelector("#order-card");
    const confirmSummary = drawer.querySelector("#confirm-summary");

    const renderStep = () => {
      stepPanels.forEach((p) => {
        p.hidden = Number(p.dataset.stepPanel) !== step;
      });
      if (progressEl) progressEl.textContent = `Қадам ${step} / 3`;
      if (errorEl) errorEl.textContent = "";
      if (step === 3 && confirmSummary) {
        const totals = shop.getTotals();
        confirmSummary.textContent = `Телефон: ${phoneInput?.value}, Мекенжай: ${addressInput?.value}, Сомасы: ${formatPrice(totals.total)}`;
      }
    };

    drawer.querySelector("#step1-next")?.addEventListener("click", () => {
      const errs = validateCheckoutFields({
        phone: phoneInput?.value,
        address: addressInput?.value,
        card: "4532015112830366"
      });
      if (errs.phone || errs.address) {
        if (errorEl) errorEl.textContent = errs.phone || errs.address;
        return;
      }
      step = 2;
      renderStep();
    });

    drawer.querySelector("#step2-back")?.addEventListener("click", () => {
      step = 1;
      renderStep();
    });

    drawer.querySelector("#step2-next")?.addEventListener("click", () => {
      const errs = validateCheckoutFields({
        phone: phoneInput?.value,
        address: addressInput?.value,
        card: cardInput?.value
      });
      if (errs.card) {
        if (errorEl) errorEl.textContent = errs.card;
        return;
      }
      step = 3;
      renderStep();
    });

    drawer.querySelector("#step3-back")?.addEventListener("click", () => {
      step = 2;
      renderStep();
    });

    drawer.querySelector("#step3-submit")?.addEventListener("click", () => {
      const order = shop.createOrder({
        phone: phoneInput?.value,
        address: addressInput?.value
      });
      if (phoneInput) phoneInput.value = "";
      if (addressInput) addressInput.value = "";
      if (cardInput) cardInput.value = "";
      step = 1;
      renderStep();
      showToast(`Тапсырыс #${order.id} қабылданды!`);
    });

    renderStep();
  }

  shop.renderAll();
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

// 73: throttle скроллына
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

initThemeToggle();
initBurgerMenu();
initCatalog();
initBookModal();
initShopInteractions();
initContactForm();
initFaqAccordion();
initHeroSlider();
initStatsCounter();
initScrollReveal();
initBackToTop();
initOpenLibrarySearch();

// Если открыта страница book.html — грузим детали после попытки fetch books.json
if (document.body.dataset.page === "book-detail") {
  loadBooksFromJson(null).then((loaded) => {
    initBookDetailPage(loaded || fallbackBooks);
  });
}