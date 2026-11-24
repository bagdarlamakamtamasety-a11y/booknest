import { books } from "./data.js";
import { createBookCard, formatPrice, showToast } from "./ui.js";

console.log("BookNest JS жүктелді. Кітаптар саны:", books.length);

// 44. Гамбургер мәзір
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

// 45. Қараңғы/ашық тақырып (localStorage)
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

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      const isDark = document.documentElement.classList.contains("dark");
      localStorage.setItem("booknest-theme", isDark ? "dark" : "light");
      updateIcon();
    });
  }
}

// 43, 46, 47, 48, 49. Каталог: рендер, іздеу, сүзгі, сұрыптау, нәтиже саны
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

  let searchQuery = "";
  let selectedGenre = "Барлығы";
  let sortBy = "default";

  if (genreChipsContainer) {
    const genres = ["Барлығы", ...new Set(books.map((b) => b.genre))];
    genreChipsContainer.innerHTML = genres
      .map(
        (genre) =>
          `<button type="button" class="chip ${genre === "Барлығы" ? "is-active" : ""}" data-genre="${genre}">${genre}</button>`
      )
      .join("");

    genreChipsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      selectedGenre = btn.dataset.genre;
      genreChipsContainer.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderBooks();
    });
  }

  function renderBooks() {
    let list = isFeaturedOnly ? books.slice(0, 4) : [...books];

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
      return;
    }

    if (emptyState) emptyState.hidden = true;
    list.forEach((book) => {
      grid.appendChild(createBookCard(book));
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderBooks();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      sortBy = e.target.value;
      renderBooks();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      searchQuery = "";
      selectedGenre = "Барлығы";
      sortBy = "default";
      if (searchInput) searchInput.value = "";
      if (sortSelect) sortSelect.value = "default";
      if (genreChipsContainer) {
        genreChipsContainer.querySelectorAll(".chip").forEach((c) => {
          c.classList.toggle("is-active", c.dataset.genre === "Барлығы");
        });
      }
      renderBooks();
    });
  }

  renderBooks();
}

// 50, 51. Модальды терезе және фокус басқару
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
          <p class="rating">${book.rating.toFixed(1)} / 5.0</p>
          <p class="modal-desc">${book.description}</p>
          <p class="price">${formatPrice(book.price)}</p>
        </div>
      </div>
    `;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".card[data-id]");
    if (card) {
      const book = books.find((b) => b.id === Number(card.dataset.id));
      if (book) openModal(book);
    }
  });

  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });
}

// 52, 53. Байланыс формасының валидациясы және toast
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

// 54. FAQ аккордеон
function initFaqAccordion() {
  const faqItems = document.querySelectorAll(".faq-item");
  if (!faqItems.length) return;

  faqItems.forEach((item) => {
    const btn = item.querySelector(".faq-question");
    btn.addEventListener("click", () => {
      const isAlreadyOpen = item.classList.contains("is-open");

      faqItems.forEach((other) => {
        other.classList.remove("is-open");
        other.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      });

      if (!isAlreadyOpen) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}

// 55. Hero слайдер (3 слайд, автоматты ауысу, hover-де тоқтау)
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

  prevBtn.addEventListener("click", () => showSlide(current - 1));
  nextBtn.addEventListener("click", () => showSlide(current + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => showSlide(i)));

  slider.addEventListener("mouseenter", stopAutoPlay);
  slider.addEventListener("mouseleave", startAutoPlay);

  startAutoPlay();
}

// 56. Статистика санауыштары (IntersectionObserver)
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

// 57. Scroll reveal
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

// 58. «Жоғарыға» батырмасы (300px)
function initBackToTop() {
  const btn = document.querySelector("#back-to-top");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    btn.classList.toggle("is-visible", window.scrollY > 300);
  });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Іске қосу
initBurgerMenu();
initThemeToggle();
initCatalog();
initBookModal();
initContactForm();
initFaqAccordion();
initHeroSlider();
initStatsCounter();
initScrollReveal();
initBackToTop();