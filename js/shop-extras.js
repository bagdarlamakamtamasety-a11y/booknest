import { showToast } from "./ui.js";
import { isValidLuhn } from "./cart-checkout.js";

// Фильтр каталога: только книги из избранного
export function initWishlistFilter(shop, getAllBooks, onFilterChange) {
  const btn = document.querySelector("#wishlist-only-btn");
  if (!btn) return false;

  let onlyWishlist = false;

  const updateBtn = () => {
    btn.classList.toggle("is-active", onlyWishlist);
    btn.setAttribute("aria-pressed", String(onlyWishlist));
    btn.textContent = onlyWishlist ? "Таңдаулылар: ҚОСУЛЫ" : "Тек таңдаулылар";
  };

  btn.addEventListener("click", () => {
    onlyWishlist = !onlyWishlist;
    updateBtn();
    if (typeof onFilterChange === "function") {
      onFilterChange();
    }
  });

  updateBtn();

  return (list) => {
    if (!onlyWishlist) return list;
    const wishIds = new Set(shop.wishlist || []);
    return list.filter((book) => wishIds.has(Number(book.id)));
  };
}

// Очистка корзины и экспорт/сброс данных магазина
export function initStorageTools(shop) {
  const clearCartBtn = document.querySelector("#clear-cart-btn");
  const resetShopBtn = document.querySelector("#reset-shop-data-btn");

  clearCartBtn?.addEventListener("click", () => {
    shop.cart = [];
    shop.promo = null;
    shop.saveState();
    shop.renderAll();
    showToast("Себет тазартылды");
  });

  resetShopBtn?.addEventListener("click", () => {
    shop.cart = [];
    shop.orders = [];
    shop.wishlist = [];
    shop.promo = null;
    shop.usedPromoCodes.clear();
    shop.saveState();
    shop.renderAll();
    showToast("Дүкен деректері бастапқы күйге қайтарылды");
  });
}

// Быстрая самопроверка ключевых функций в консоли (вызывается по кнопке или в DevTools)
export function runQuickSelfChecks(shop) {
  const checks = [
    {
      name: "Luhn valid card",
      pass: isValidLuhn("4532015112830366") === true
    },
    {
      name: "Luhn invalid card",
      pass: isValidLuhn("4532015112830367") === false
    },
    {
      name: "Promo BOOK10 works",
      pass: (() => {
        const prevPromo = shop.promo;
        shop.cart = [{ bookId: 1, qty: 1 }];
        const res = shop.applyPromo("BOOK10");
        shop.promo = prevPromo;
        return res.ok === true;
      })()
    }
  ];

  const allPassed = checks.every((c) => c.pass);
  console.table(checks);
  showToast(allPassed ? "Барлық 3 автотест өтті!" : "Кейбір автотесттер өтпеді — Console қараңыз");
  return allPassed;
}