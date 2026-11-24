import { books } from "./data.js";
import { formatPrice, showToast } from "./ui.js";

const CART_KEY = "booknest_cart_v1";
const ORDERS_KEY = "booknest_orders_v1";
const WISHLIST_KEY = "booknest_wishlist_v1";

// Безопасное чтение из localStorage (критерий 62: битые данные не роняют сайт)
function safeReadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("Деректерді сақтау мүмкін болмады");
  }
}

// Алгоритм Луна для проверки номера карты (задание 66)
export function isValidLuhn(cardNumber) {
  const digits = String(cardNumber).replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

// Валидация +7 телефон, адрес, карта (задание 66)
export function validateCheckoutFields({ phone, address, card }) {
  const errors = {};
  const cleanPhone = String(phone).trim();
  if (!/^\+7\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(cleanPhone)) {
    errors.phone = "Телефон +7 XXX XXX XX XX форматында болуы керек";
  }

  if (String(address).trim().length < 6) {
    errors.address = "Мекенжайды толық көрсетіңіз (кемінде 6 таңба)";
  }

  if (!isValidLuhn(card)) {
    errors.card = "Карта нөмірі қате (Luhn тексерісі өтпеді)";
  }

  return errors;
}

export class ShopManager {
  constructor() {
    this.cart = safeReadJSON(CART_KEY, []); // [{ bookId, qty }]
    this.orders = safeReadJSON(ORDERS_KEY, []);
    this.wishlist = safeReadJSON(WISHLIST_KEY, []);
    this.promo = null; // { code, type, value, expiresAt }
    this.usedPromoCodes = new Set();

    // Промокоды (задание 64: процент, фиксированная скидка, бесплатная доставка)
    this.promoCatalog = {
      BOOK10: { type: "percent", value: 10, expiresAt: "2027-12-31" },
      MINUS1500: { type: "fixed", value: 1500, expiresAt: "2027-12-31" },
      FREEDEL: { type: "free_shipping", value: 1000, expiresAt: "2027-12-31" },
      OLD2020: { type: "percent", value: 20, expiresAt: "2020-01-01" }
    };
  }

  saveState() {
    safeWriteJSON(CART_KEY, this.cart);
    safeWriteJSON(ORDERS_KEY, this.orders);
    safeWriteJSON(WISHLIST_KEY, this.wishlist);
  }

  // 61: добавление увеличивает qty, если книга уже в корзине
  addToCart(bookId, qty = 1) {
    const book = books.find((b) => b.id === Number(bookId));
    if (!book) return;

    const existing = this.cart.find((item) => item.bookId === book.id);
    if (existing) {
      existing.qty += qty;
    } else {
      this.cart.push({ bookId: book.id, qty });
    }
    this.saveState();
    showToast(`«${book.title}» себетке қосылды`);
    this.renderAll();
  }

  updateQty(bookId, delta) {
    const item = this.cart.find((i) => i.bookId === Number(bookId));
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      this.removeFromCart(bookId);
      return;
    }
    this.saveState();
    this.renderAll();
  }

  removeFromCart(bookId) {
    this.cart = this.cart.filter((i) => i.bookId !== Number(bookId));
    this.saveState();
    this.renderAll();
  }

  getTotals() {
    let subtotal = 0;
    let totalCount = 0;

    for (const item of this.cart) {
      const book = books.find((b) => b.id === item.bookId);
      if (book) {
        subtotal += book.price * item.qty;
        totalCount += item.qty;
      }
    }

    let shipping = totalCount > 0 ? 1000 : 0;
    let discount = 0;

    if (this.promo && totalCount > 0) {
      if (this.promo.type === "percent") {
        discount = Math.round((subtotal * this.promo.value) / 100);
      } else if (this.promo.type === "fixed") {
        discount = Math.min(subtotal, this.promo.value);
      } else if (this.promo.type === "free_shipping") {
        shipping = 0;
      }
    }

    const total = Math.max(0, subtotal - discount + shipping);
    return { subtotal, discount, shipping, total, totalCount };
  }

  // 64: проверка промокода
  applyPromo(rawCode) {
    const code = String(rawCode || "").trim().toUpperCase();
    const rule = this.promoCatalog[code];

    if (!rule) {
      return { ok: false, message: "Қате промокод. Қолжетімді: BOOK10, MINUS1500, FREEDEL" };
    }
    if (this.usedPromoCodes.has(code)) {
      return { ok: false, message: "Бұл промокод бұрын қолданылған" };
    }
    if (new Date(rule.expiresAt) < new Date()) {
      return { ok: false, message: "Промокодтың мерзімі өтіп кеткен" };
    }

    this.promo = { code, ...rule };
    this.renderAll();
    return { ok: true, message: `«${code}» промокоды қолданылды` };
  }

  // 68: избранное (wishlist)
  toggleWishlist(bookId) {
    const id = Number(bookId);
    const idx = this.wishlist.indexOf(id);
    if (idx >= 0) {
      this.wishlist.splice(idx, 1);
      showToast("Таңдаулылардан алынды");
    } else {
      this.wishlist.push(id);
      showToast("Таңдаулыларға қосылды");
    }
    this.saveState();
    this.renderAll();
  }

  // 67: создание заказа и повтор заказа
  createOrder(deliveryInfo) {
    const totals = this.getTotals();
    const itemsDetail = this.cart
      .map((item) => {
        const book = books.find((b) => b.id === item.bookId);
        return book ? { bookId: book.id, title: book.title, price: book.price, qty: item.qty } : null;
      })
      .filter(Boolean);

    const newOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString("kk-KZ"),
      total: totals.total,
      promo: this.promo ? this.promo.code : null,
      delivery: deliveryInfo,
      items: itemsDetail
    };

    if (this.promo) {
      this.usedPromoCodes.add(this.promo.code);
      this.promo = null;
    }

    this.orders.unshift(newOrder);
    this.cart = [];
    this.saveState();
    this.renderAll();
    return newOrder;
  }

  repeatOrder(orderId) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return;
    for (const item of order.items) {
      this.addToCart(item.bookId, item.qty);
    }
    showToast(`#${order.id} тапсырыс себетке қайта қосылды`);
  }

  renderAll() {
    const cartCountEls = document.querySelectorAll("[data-cart-count]");
    const wishCountEls = document.querySelectorAll("[data-wishlist-count]");
    const { subtotal, discount, shipping, total, totalCount } = this.getTotals();

    cartCountEls.forEach((el) => (el.textContent = String(totalCount)));
    wishCountEls.forEach((el) => (el.textContent = String(this.wishlist.length)));

    // Обновляем сердечки на карточках
    document.querySelectorAll("[data-wish-btn]").forEach((btn) => {
      const id = Number(btn.dataset.wishBtn);
      const active = this.wishlist.includes(id);
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
      btn.textContent = active ? "♥" : "♡";
    });

    // Рендер содержимого drawer
    const itemsContainer = document.querySelector("#cart-drawer-items");
    if (itemsContainer) {
      if (this.cart.length === 0) {
        itemsContainer.innerHTML = `<p class="muted">Себет бос.</p>`;
      } else {
        itemsContainer.innerHTML = this.cart
          .map((item) => {
            const book = books.find((b) => b.id === item.bookId);
            if (!book) return "";
            return `
              <div class="cart-item" data-cart-id="${book.id}">
                <div>
                  <strong>${book.title}</strong>
                  <div class="muted">${formatPrice(book.price)}</div>
                </div>
                <div class="cart-qty-controls">
                  <button type="button" class="qty-dec" data-id="${book.id}">-</button>
                  <span>${item.qty}</span>
                  <button type="button" class="qty-inc" data-id="${book.id}">+</button>
                  <button type="button" class="qty-rem" data-id="${book.id}" aria-label="Жою">&times;</button>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }

    const summaryEl = document.querySelector("#cart-drawer-summary");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div>Аралық сома: <strong>${formatPrice(subtotal)}</strong></div>
        <div>Жеңілдік: <strong>-${formatPrice(discount)}</strong></div>
        <div>Жеткізу: <strong>${formatPrice(shipping)}</strong></div>
        <div class="cart-total">Барлығы: <strong>${formatPrice(total)}</strong></div>
      `;
    }

    // Рендер истории заказов (если есть контейнер)
    const ordersEl = document.querySelector("#orders-history");
    if (ordersEl) {
      if (this.orders.length === 0) {
        ordersEl.innerHTML = `<p class="muted">Әзірге тапсырыстар тарихы бос.</p>`;
      } else {
        ordersEl.innerHTML = this.orders
          .map(
            (o) => `
            <div class="order-card">
              <div><strong>#${o.id}</strong> · ${o.date} · <strong>${formatPrice(o.total)}</strong></div>
              <div class="muted">${o.items.map((i) => `${i.title} (x${i.qty})`).join(", ")}</div>
              <button type="button" class="btn-outline repeat-order-btn" data-order-id="${o.id}">Қайта тапсырыс беру</button>
            </div>
          `
          )
          .join("");
      }
    }
  }
}