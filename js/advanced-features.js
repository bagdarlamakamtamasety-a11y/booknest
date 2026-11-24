import { books as fallbackBooks } from "./data.js";
import { createBookCard, formatPrice, showToast } from "./ui.js";

// 73: debounce және throttle
export function debounce(fn, delay = 300) {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, limit = 200) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// 74: books.json арқылы fetch (индикатор, қате, қайталау батырмасы)
export async function loadBooksFromJson(statusContainer, onRetry) {
  if (statusContainer) {
    statusContainer.innerHTML = `<div class="loading-box">Кітаптар жүктелуде...</div>`;
  }
  try {
    const res = await fetch("books.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (statusContainer) statusContainer.innerHTML = "";
    return Array.isArray(data) && data.length > 0 ? data : fallbackBooks;
  } catch (err) {
    if (statusContainer) {
      statusContainer.innerHTML = `
        <div class="error-box">
          <p>Кітаптарды жүктеу кезінде қате шықты (${err.message}).</p>
          <button type="button" id="retry-books-fetch" class="btn">Қайталау</button>
        </div>
      `;
      statusContainer.querySelector("#retry-books-fetch")?.addEventListener("click", () => {
        if (onRetry) onRetry();
      });
    }
    return null;
  }
}

// 70: Ұқсас кітаптар (ұпай жүйесі: жанр +3, автор +4, баға айырмасы <= 1500 +2)
export function getSimilarBooks(currentBook, allBooks, limit = 4) {
  return allBooks
    .filter((b) => b.id !== currentBook.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.genre === currentBook.genre) score += 3;
      if (candidate.author === currentBook.author) score += 4;
      if (Math.abs(candidate.price - currentBook.price) <= 1500) score += 2;
      return { book: candidate, score };
    })
    .sort((a, b) => b.score - a.score || b.book.rating - a.book.rating)
    .slice(0, limit)
    .map((entry) => entry.book);
}

// 69-71: book.html?id=3 беті
export function initBookDetailPage(allBooks) {
  const container = document.querySelector("#book-detail-container");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("id");
  const book = allBooks.find((b) => String(b.id) === String(idParam));

  if (!book) {
    container.innerHTML = `
      <div class="empty-state">
        <h1>Кітап табылмады</h1>
        <p>Көрсетілген ID бойынша кітап базада жоқ.</p>
        <a href="books.html" class="btn">Каталогқа оралу</a>
      </div>
    `;
    return;
  }

  document.title = `${book.title} — BookNest`;
  container.innerHTML = `
    <div class="book-detail-card">
      <img src="${book.cover}" alt="${book.title}" width="260" height="360">
      <div>
        <span class="modal-genre">${book.genre} · ${book.year} ж.</span>
        <h1>${book.title}</h1>
        <p class="author">Авторы: <strong>${book.author}</strong></p>
        <p class="rating" id="detail-avg-rating">${book.rating.toFixed(1)} / 5.0</p>
        <p>${book.description}</p>
        <p class="price">${formatPrice(book.price)}</p>
        <button type="button" class="btn" data-add-cart="${book.id}">Себетке қосу</button>
      </div>
    </div>
  `;

  // 70: Ұқсас кітаптар
  const similarSection = document.querySelector("#similar-section");
  const similarGrid = document.querySelector("#similar-books-grid");
  if (similarSection && similarGrid) {
    similarSection.hidden = false;
    similarGrid.innerHTML = "";
    getSimilarBooks(book, allBooks, 4).forEach((sim) => {
      similarGrid.appendChild(createBookCard(sim));
    });
  }

  // 71: Рейтинг және пікірлер (бір адам бір кітапқа бір рет қана баға береді)
  const reviewsSection = document.querySelector("#reviews-section");
  const reviewsKey = `booknest_reviews_${book.id}`;
  const ratedUsersKey = `booknest_rated_users_${book.id}`;

  let reviews = JSON.parse(localStorage.getItem(reviewsKey) || "[]");
  let ratedUsers = JSON.parse(localStorage.getItem(ratedUsersKey) || "[]");

  const breakdownEl = document.querySelector("#rating-breakdown");
  const listEl = document.querySelector("#reviews-list");
  const formEl = document.querySelector("#review-form");
  const msgEl = document.querySelector("#review-message");
  const avgEl = document.querySelector("#detail-avg-rating");

  function renderReviews() {
    if (!reviewsSection) return;
    reviewsSection.hidden = false;

    const totalVotes = reviews.length;
    const avgScore =
      totalVotes > 0
        ? (reviews.reduce((acc, r) => acc + r.stars, 0) / totalVotes).toFixed(1)
        : book.rating.toFixed(1);

    if (avgEl) avgEl.textContent = `${avgScore} / 5.0 (${totalVotes} пікір)`;

    if (breakdownEl) {
      breakdownEl.innerHTML = [5, 4, 3, 2, 1]
        .map((star) => {
          const count = reviews.filter((r) => r.stars === star).length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          return `<div>${star} жұлдыз: <strong>${pct}%</strong> (${count})</div>`;
        })
        .join("");
    }

    if (listEl) {
      listEl.innerHTML =
        reviews.length === 0
          ? `<p class="muted">Әзірге пікір жоқ. Бірінші болып жазыңыз!</p>`
          : reviews
              .map(
                (r) => `
              <div class="order-card">
                <strong>${r.name}</strong> · <span>${"★".repeat(r.stars)}</span>
                <p>${r.text}</p>
              </div>
            `
              )
              .join("");
    }
  }

  formEl?.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.querySelector("#reviewer-name");
    const starsSelect = document.querySelector("#review-stars");
    const textInput = document.querySelector("#review-text");

    const userKey = nameInput.value.trim().toLowerCase();
    if (!userKey) return;

    if (ratedUsers.includes(userKey)) {
      if (msgEl) msgEl.textContent = "Сіз бұл кітапқа бұрын баға қойғансыз (бір рет қана мүмкін).";
      return;
    }

    const stars = Number(starsSelect.value);
    reviews.unshift({
      name: nameInput.value.trim(),
      stars,
      text: textInput.value.trim()
    });
    ratedUsers.push(userKey);

    localStorage.setItem(reviewsKey, JSON.stringify(reviews));
    localStorage.setItem(ratedUsersKey, JSON.stringify(ratedUsers));

    if (msgEl) msgEl.textContent = "Пікіріңіз сақталды!";
    formEl.reset();
    renderReviews();
    showToast("Пікір қосылды!");
  });

  renderReviews();
}

// 75-76: Open Library API + AbortController
export function initOpenLibrarySearch() {
  const input = document.querySelector("#openlib-search-input");
  const resultsEl = document.querySelector("#openlib-results");
  const statusEl = document.querySelector("#openlib-status");
  if (!input || !resultsEl) return;

  let activeController = null;

  const runSearch = debounce(async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      resultsEl.innerHTML = "";
      if (statusEl) statusEl.textContent = "";
      return;
    }

    if (activeController) {
      activeController.abort();
    }
    activeController = new AbortController();

    if (statusEl) statusEl.textContent = "Open Library ізделуде...";

    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&limit=6`;
      const res = await fetch(url, { signal: activeController.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (statusEl) statusEl.textContent = `Open Library нәтижесі: ${data.docs.length} кітап`;

      resultsEl.innerHTML = data.docs
        .map((doc) => {
          const coverUrl = doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : "images/book2.jpg";
          const author = doc.author_name ? doc.author_name[0] : "Автор белгісіз";
          const year = doc.first_publish_year || "—";

          return `
            <article class="card">
              <img src="${coverUrl}" alt="${doc.title}" width="180" height="250" loading="lazy">
              <h3>${doc.title}</h3>
              <p class="author">${author} · ${year}</p>
            </article>
          `;
        })
        .join("");
    } catch (err) {
      if (err.name === "AbortError") {
        // Ескі сұраныс тоқтатылды — қалыпты жағдай
        return;
      }
      if (statusEl) statusEl.textContent = `Іздеу қатесі: ${err.message}`;
    }
  }, 400);

  input.addEventListener("input", (e) => runSearch(e.target.value));
}