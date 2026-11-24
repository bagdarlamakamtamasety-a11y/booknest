export function formatPrice(price) {
  return `${Number(price).toLocaleString("kk-KZ")} ₸`;
}

export function createBookCard(book) {
  const article = document.createElement("article");
  article.className = "card";
  article.dataset.id = book.id;
  article.tabIndex = 0;

  article.innerHTML = `
    ${book.isNew ? '<span class="badge-new">Жаңа</span>' : ""}
    <img src="${book.cover}" alt="${book.title} кітабының мұқабасы" width="240" height="340" loading="lazy">
    <h3>${book.title}</h3>
    <p class="author">${book.author} · ${book.genre}</p>
    <p class="rating">${book.rating.toFixed(1)}</p>
    <p class="price">${formatPrice(book.price)}</p>
    <div class="card-actions">
      <button type="button" class="btn add-to-cart-btn" data-add-cart="${book.id}">Себетке</button>
      <button type="button" class="wish-btn" data-wish-btn="${book.id}" aria-label="Таңдаулыларға қосу" aria-pressed="false">♡</button>
    </div>
  `;

  return article;
}

export function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3500);
}