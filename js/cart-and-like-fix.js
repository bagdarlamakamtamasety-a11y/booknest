import { books as fallbackBooks } from "./data.js";
import { formatPrice, showToast } from "./ui.js";
import { getCustomBooks } from "./admin.js";

const CART_KEY = "booknest_cart_v1";
const WISH_KEY = "booknest_wishlist_v1";
const ORDERS_KEY = "booknest_orders_v1";

function getAllBooks() {
  const custom = typeof getCustomBooks === "function" ? getCustomBooks() : [];
  const combined = [...custom, ...fallbackBooks];
  const seen = new Set();
  return combined.filter((b) => {
    const id = Number(b.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function isValidLuhn(numStr) {
  const digits = String(numStr || "").replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function ensureAdminNavLink() {
  document.querySelectorAll(".nav-list").forEach((navList) => {
    if (!navList.querySelector('a[href$="admin.html"]')) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="admin.html">Админ</a>`;
      navList.appendChild(li);
    }
  });
}

function syncLikeButtonsUI(wishlist) {
  const wishSet = new Set(wishlist.map(Number));

  document.querySelectorAll(".card[data-id]").forEach((card) => {
    const bookId = Number(card.dataset.id);
    if (!bookId) return;

    let wishBtn = card.querySelector("[data-wish-btn]");
    if (!wishBtn) {
      const actions = card.querySelector(".card-actions") || card;
      wishBtn = document.createElement("button");
      wishBtn.type = "button";
      wishBtn.className = "btn-outline wish-btn";
      wishBtn.dataset.wishBtn = String(bookId);
      wishBtn.setAttribute("aria-label", "Таңдаулыға қосу");
      actions.appendChild(wishBtn);
    }

    const liked = wishSet.has(bookId);
    wishBtn.textContent = liked ? "♥" : "♡";
    wishBtn.classList.toggle("is-liked", liked);
    wishBtn.setAttribute("aria-pressed", String(liked));
  });

  document.querySelectorAll("[data-wish-btn]").forEach((btn) => {
    const id = Number(btn.dataset.wishBtn);
    if (!id) return;
    const liked = wishSet.has(id);
    btn.textContent = liked ? "♥" : "♡";
    btn.classList.toggle("is-liked", liked);
    btn.setAttribute("aria-pressed", String(liked));
  });

  document.querySelectorAll("[data-wish-count]").forEach((el) => {
    el.textContent = String(wishlist.length);
  });
}

let isInitialized = false;

export function initCartAndLikes() {
  ensureAdminNavLink();

  if (isInitialized) {
    syncLikeButtonsUI(readJson(WISH_KEY, []));
    return;
  }
  isInitialized = true;

  let cart = readJson(CART_KEY, []);
  let wishlist = readJson(WISH_KEY, []);
  let discountRate = 0;

  const saveCart = () => writeJson(CART_KEY, cart);
  const saveWish = () => writeJson(WISH_KEY, wishlist);

  const calcTotals = () => {
    const booksMap = new Map(getAllBooks().map((b) => [Number(b.id), b]));
    let subtotal = 0;
    let totalQty = 0;

    for (const item of cart) {
      const book = booksMap.get(Number(item.id));
      const price = Number(book ? book.price : item.price || 0);
      const qty = Math.max(1, Number(item.qty || 1));
      subtotal += price * qty;
      totalQty += qty;
    }

    const discount = Math.round(subtotal * discountRate);
    const afterDiscount = Math.max(0, subtotal - discount);
    const delivery = totalQty === 0 || afterDiscount >= 10000 ? 0 : 1000;
    const total = afterDiscount + delivery;

    return { subtotal, discount, delivery, total, totalQty };
  };

  const renderOrders = () => {
    const box = document.querySelector("#orders-history");
    if (!box) return;
    const orders = readJson(ORDERS_KEY, []);
    if (!orders.length) {
      box.innerHTML = `<p class="muted">Тапсырыстар әлі жоқ.</p>`;
      return;
    }
    box.innerHTML = orders
      .map(
        (o) => `
        <div class="checkout-box" style="margin-bottom: 0.6rem; padding: 0.6rem;">
          <strong>#${o.id}</strong> · ${o.status || "Рәсімделді"} · <strong>${formatPrice(o.total)}</strong>
          <div class="muted">${o.phone || ""} — ${o.address || ""}</div>
        </div>
      `
      )
      .join("");
  };

  const renderCart = () => {
    const totals = calcTotals();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(totals.totalQty);
    });

    const itemsEl = document.querySelector("#cart-drawer-items");
    const summaryEl = document.querySelector("#cart-drawer-summary");
    const booksMap = new Map(getAllBooks().map((b) => [Number(b.id), b]));

    if (itemsEl) {
      if (!cart.length) {
        itemsEl.innerHTML = `<p class="muted">Себет бос.</p>`;
      } else {
        itemsEl.innerHTML = cart
          .map((item) => {
            const book = booksMap.get(Number(item.id)) || item;
            const qty = Math.max(1, Number(item.qty || 1));
            const lineSum = Number(book.price || 0) * qty;
            return `
              <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                <div>
                  <div><strong>${book.title}</strong></div>
                  <div class="muted">${formatPrice(book.price)} × ${qty} = <strong>${formatPrice(lineSum)}</strong></div>
                </div>
                <div style="display:flex; gap:0.25rem;">
                  <button type="button" class="btn-outline qty-dec" data-id="${book.id}">-</button>
                  <button type="button" class="btn-outline qty-inc" data-id="${book.id}">+</button>
                  <button type="button" class="btn-outline qty-rem" data-id="${book.id}">×</button>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div>Аралық сома: <strong>${formatPrice(totals.subtotal)}</strong></div>
        <div>Жеңілдік: <strong>-${formatPrice(totals.discount)}</strong></div>
        <div>Жеткізу: <strong>${formatPrice(totals.delivery)}</strong></div>
        <div style="margin-top:0.4rem;">Барлығы: <strong>${formatPrice(totals.total)}</strong></div>
      `;
    }

    ensureAdminNavLink();
    syncLikeButtonsUI(wishlist);
    renderOrders();
  };

  const addBookToCart = (id) => {
    const numId = Number(id);
    if (!numId) return;
    const book = getAllBooks().find((b) => Number(b.id) === numId);
    const title = book ? book.title : `Кітап #${numId}`;
    const price = book ? Number(book.price) : 0;

    const existing = cart.find((item) => Number(item.id) === numId);
    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + 1;
      if (price > 0) existing.price = price;
    } else {
      cart.push({ id: numId, title, price, qty: 1 });
    }
    saveCart();
    renderCart();
    showToast(`«${title}» себетке қосылды`);
  };

  const toggleLike = (id) => {
    const numId = Number(id);
    if (!numId) return;
    const exists = wishlist.map(Number).includes(numId);
    if (exists) {
      wishlist = wishlist.filter((x) => Number(x) !== numId);
      showToast("Таңдаулылардан алынды");
    } else {
      wishlist.push(numId);
      showToast("Таңдаулыларға қосылды ♥");
    }
    saveWish();
    syncLikeButtonsUI(wishlist);
  };

  document.addEventListener(
    "click",
    (e) => {
      const addBtn = e.target.closest("[data-add-cart]");
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        addBookToCart(addBtn.dataset.addCart);
        return;
      }

      const wishBtn = e.target.closest("[data-wish-btn]");
      if (wishBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleLike(wishBtn.dataset.wishBtn);
        return;
      }

      if (e.target.closest("#clear-cart-btn")) {
        e.preventDefault();
        cart = [];
        discountRate = 0;
        saveCart();
        renderCart();
        showToast("Себет тазартылды");
        return;
      }

      const drawer = document.querySelector("#cart-drawer");
      if (e.target.closest("[data-open-cart]") && drawer) {
        drawer.hidden = false;
        renderCart();
        return;
      }
      if ((e.target.closest(".drawer-close") || e.target === drawer) && drawer) {
        drawer.hidden = true;
        return;
      }

      const inc = e.target.closest(".qty-inc");
      const dec = e.target.closest(".qty-dec");
      const rem = e.target.closest(".qty-rem");
      if (inc || dec || rem) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const id = Number((inc || dec || rem).dataset.id);
        const idx = cart.findIndex((i) => Number(i.id) === id);
        if (idx === -1) return;
        if (inc) cart[idx].qty += 1;
        if (dec) {
          cart[idx].qty -= 1;
          if (cart[idx].qty <= 0) cart.splice(idx, 1);
        }
        if (rem) cart.splice(idx, 1);
        saveCart();
        renderCart();
      }
    },
    true
  );

  const drawer = document.querySelector("#cart-drawer");
  if (drawer) {
    drawer.querySelector("#promo-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const code = String(drawer.querySelector("#promo-input")?.value || "").trim().toUpperCase();
      const msg = drawer.querySelector("#promo-message");
      if (code === "BOOK10") {
        discountRate = 0.1;
        if (msg) msg.textContent = "10% жеңілдік қосылды!";
      } else if (code === "BOOK20") {
        discountRate = 0.2;
        if (msg) msg.textContent = "20% жеңілдік қосылды!";
      } else {
        discountRate = 0;
        if (msg) msg.textContent = "Промокод табылмады (BOOK10 немесе BOOK20)";
      }
      renderCart();
    });

    let step = 1;
    const phoneEl = drawer.querySelector("#order-phone");
    const addrEl = drawer.querySelector("#order-address");
    const cardEl = drawer.querySelector("#order-card");
    const errEl = drawer.querySelector("#checkout-error");
    const progEl = drawer.querySelector("#checkout-progress");
    const confEl = drawer.querySelector("#confirm-summary");

    const setStep = (nextStep) => {
      step = nextStep;
      drawer.querySelectorAll("[data-step-panel]").forEach((p) => {
        p.hidden = Number(p.dataset.stepPanel) !== step;
      });
      if (progEl) progEl.textContent = `Қадам ${step} / 3`;
      if (errEl) errEl.textContent = "";
      if (step === 3 && confEl) {
        confEl.textContent = `${phoneEl?.value}, ${addrEl?.value} — ${formatPrice(calcTotals().total)}`;
      }
    };

    drawer.querySelector("#step1-next")?.addEventListener("click", () => {
      if (!cart.length) {
        if (errEl) errEl.textContent = "Алдымен себетке кітап салыңыз.";
        return;
      }
      if ((phoneEl?.value || "").trim().length < 6 || (addrEl?.value || "").trim().length < 3) {
        if (errEl) errEl.textContent = "Телефон мен мекенжайды толтырыңыз.";
        return;
      }
      setStep(2);
    });

    drawer.querySelector("#step2-back")?.addEventListener("click", () => setStep(1));

    drawer.querySelector("#step2-next")?.addEventListener("click", () => {
      if (!isValidLuhn(cardEl?.value)) {
        if (errEl) errEl.textContent = "Карта қате (тест: 4532015112830366).";
        return;
      }
      setStep(3);
    });

    drawer.querySelector("#step3-back")?.addEventListener("click", () => setStep(2));

    drawer.querySelector("#step3-submit")?.addEventListener("click", () => {
      const totals = calcTotals();
      const orders = readJson(ORDERS_KEY, []);
      const newOrder = {
        id: Date.now(),
        createdAt: new Date().toLocaleString("kk-KZ"),
        status: "Рәсімделді",
        phone: phoneEl?.value.trim() || "",
        address: addrEl?.value.trim() || "",
        items: [...cart],
        total: totals.total
      };
      orders.unshift(newOrder);
      writeJson(ORDERS_KEY, orders);

      cart = [];
      discountRate = 0;
      saveCart();
      if (phoneEl) phoneEl.value = "";
      if (addrEl) addrEl.value = "";
      if (cardEl) cardEl.value = "";
      setStep(1);
      renderCart();
      showToast(`Тапсырыс #${newOrder.id} сақталды!`);
    });
  }

  const observer = new MutationObserver(() => {
    ensureAdminNavLink();
    syncLikeButtonsUI(wishlist);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  renderCart();
}