import { showToast, formatPrice } from "./ui.js";

const CUSTOM_BOOKS_KEY = "booknest_custom_books";
const ORDERS_KEY = "booknest_orders_v1";

export function getCustomBooks() {
  try {
    const raw = localStorage.getItem(CUSTOM_BOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomBooks(list) {
  localStorage.setItem(CUSTOM_BOOKS_KEY, JSON.stringify(list));
}

export function addCustomBook(bookData) {
  const title = String(bookData.title || "").trim();
  const author = String(bookData.author || "").trim();
  const genre = String(bookData.genre || "Роман").trim();
  const price = Number(bookData.price);
  const rating = Math.min(5, Math.max(1, Number(bookData.rating) || 4.8));
  const year = Number(bookData.year) || 2026;
  const cover = String(bookData.cover || "images/book-placeholder.jpg").trim();
  const description = String(bookData.description || "Жаңа кітап сипаттамасы.").trim();

  if (!title || !author || Number.isNaN(price) || price <= 0) {
    return { ok: false, message: "Кітап атын, авторын және дұрыс бағасын енгізіңіз." };
  }

  const current = getCustomBooks();
  const newBook = {
    id: Date.now(),
    title,
    author,
    genre,
    price,
    rating,
    year,
    cover,
    description,
    isCustom: true
  };

  current.unshift(newBook);
  saveCustomBooks(current);
  return { ok: true, book: newBook, message: `«${title}» каталогқа қосылды!` };
}

export function deleteCustomBook(id) {
  const numId = Number(id);
  const filtered = getCustomBooks().filter((b) => Number(b.id) !== numId);
  saveCustomBooks(filtered);
  return filtered;
}

export function getOrdersList() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function updateOrderStatus(orderId, status) {
  const orders = getOrdersList();
  const updated = orders.map((order) =>
    String(order.id) === String(orderId) ? { ...order, status } : order
  );
  localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  return updated;
}

export function downloadOrderReceipt(order) {
  const lines = [
    "==========================================",
    "           BOOKNEST — ТАПСЫРЫС ЧЕГІ",
    "==========================================",
    `Тапсырыс №: ${order.id}`,
    `Күні: ${order.createdAt || new Date().toLocaleString("kk-KZ")}`,
    `Статусы: ${order.status || "Рәсімделді"}`,
    `Телефон: ${order.phone || "-"}`,
    `Мекенжай: ${order.address || "-"}`,
    "------------------------------------------",
    "Кітаптар:",
    ...(order.items || []).map(
      (item) => `  - ${item.title} x${item.qty} = ${formatPrice((item.price || 0) * (item.qty || 1))}`
    ),
    "------------------------------------------",
    `Жалпы сома: ${formatPrice(order.total || 0)}`,
    "=========================================="
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booknest-receipt-${order.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function initAdminPage(baseBooks = []) {
  const addBookForm = document.querySelector("#admin-add-book-form");
  const adminBooksBody = document.querySelector("#admin-books-tbody");
  const adminOrdersBody = document.querySelector("#admin-orders-tbody");
  const exportBtn = document.querySelector("#admin-export-json-btn");

  if (!addBookForm && !adminBooksBody && !adminOrdersBody) return;

  const renderBooksTable = () => {
    if (!adminBooksBody) return;
    const custom = getCustomBooks();
    const all = [...custom, ...baseBooks];

    adminBooksBody.innerHTML = all
      .map(
        (b) => `
      <tr>
        <td>${b.title}</td>
        <td>${b.author}</td>
        <td>${b.genre}</td>
        <td>${formatPrice(b.price)}</td>
        <td>${Number(b.rating || 4.8).toFixed(1)}</td>
        <td>
          ${
            b.isCustom
              ? `<button type="button" class="btn-outline" data-del-book="${b.id}">Өшіру</button>`
              : `<span class="muted">Базалық</span>`
          }
        </td>
      </tr>
    `
      )
      .join("");
  };

  const renderOrdersTable = () => {
    if (!adminOrdersBody) return;
    const orders = getOrdersList();

    if (!orders.length) {
      adminOrdersBody.innerHTML = `<tr><td colspan="5" class="muted">Әзірге тапсырыстар жоқ.</td></tr>`;
      return;
    }

    adminOrdersBody.innerHTML = orders
      .map(
        (o) => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.phone || "-"} / ${o.address || "-"}</td>
        <td>${formatPrice(o.total || 0)}</td>
        <td>
          <select data-order-status="${o.id}">
            <option value="Рәсімделді" ${o.status === "Рәсімделді" ? "selected" : ""}>Рәсімделді</option>
            <option value="Жолда" ${o.status === "Жолда" ? "selected" : ""}>Жолда</option>
            <option value="Жеткізілді" ${o.status === "Жеткізілді" ? "selected" : ""}>Жеткізілді</option>
          </select>
        </td>
        <td>
          <button type="button" class="btn-outline" data-download-receipt="${o.id}">Чек (.txt)</button>
        </td>
      </tr>
    `
      )
      .join("");
  };

  addBookForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const res = addCustomBook({
      title: addBookForm.querySelector("#adm-title")?.value,
      author: addBookForm.querySelector("#adm-author")?.value,
      genre: addBookForm.querySelector("#adm-genre")?.value,
      price: addBookForm.querySelector("#adm-price")?.value,
      rating: addBookForm.querySelector("#adm-rating")?.value,
      year: addBookForm.querySelector("#adm-year")?.value,
      cover: addBookForm.querySelector("#adm-cover")?.value,
      description: addBookForm.querySelector("#adm-desc")?.value
    });

    showToast(res.message);
    if (res.ok) {
      addBookForm.reset();
      renderBooksTable();
    }
  });

  adminBooksBody?.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-del-book]");
    if (!delBtn) return;
    deleteCustomBook(delBtn.dataset.delBook);
    showToast("Кітап өшірілді");
    renderBooksTable();
  });

  adminOrdersBody?.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-order-status]");
    if (!sel) return;
    updateOrderStatus(sel.dataset.orderStatus, sel.value);
    showToast(`Статус жаңартылды: ${sel.value}`);
  });

  adminOrdersBody?.addEventListener("click", (e) => {
    const dlBtn = e.target.closest("[data-download-receipt]");
    if (!dlBtn) return;
    const order = getOrdersList().find((o) => String(o.id) === String(dlBtn.dataset.downloadReceipt));
    if (order) {
      downloadOrderReceipt(order);
      showToast("Чек жүктелді");
    }
  });

  exportBtn?.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      customBooks: getCustomBooks(),
      orders: getOrdersList()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "booknest-admin-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("JSON экспортталды");
  });

  renderBooksTable();
  renderOrdersTable();
}