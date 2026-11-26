import { showToast } from "./ui.js";

const USER_KEY = "booknest_user_profile";
const GOAL_KEY = "booknest_reading_goal";

export class UserAccountManager {
  constructor() {
    this.user = this.loadUser();
    this.readingGoal = this.loadGoal();
  }

  loadUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  loadGoal() {
    try {
      const raw = localStorage.getItem(GOAL_KEY);
      return raw ? JSON.parse(raw) : { target: 12, completed: 4 };
    } catch {
      return { target: 12, completed: 4 };
    }
  }

  saveUser() {
    if (this.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  saveGoal() {
    localStorage.setItem(GOAL_KEY, JSON.stringify(this.readingGoal));
  }

  // Задания 91–93: Вход / Регистрация / Выход
  login({ name, email }) {
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanName || !cleanEmail.includes("@")) {
      return { ok: false, message: "Дұрыс аты-жөніңіз бен email енгізіңіз." };
    }

    const existing = this.loadUser();
    this.user = {
      name: cleanName,
      email: cleanEmail,
      bonusPoints: existing && existing.email === cleanEmail ? existing.bonusPoints : 500, // Приветственные 500 ₸ бонусов
      joinedAt: existing?.joinedAt || new Date().toLocaleDateString("kk-KZ")
    };
    this.saveUser();
    this.renderAccountWidget();
    return { ok: true, message: `Қош келдіңіз, ${this.user.name}! (+500 бонус)` };
  }

  logout() {
    this.user = null;
    this.saveUser();
    this.renderAccountWidget();
    showToast("Жүйеден шықтыңыз");
  }

  // Задания 94–96: Начисление (5%) и списание кэшбэк-бонусов
  earnBonusFromOrder(orderTotal) {
    if (!this.user) return 0;
    const earned = Math.round(Number(orderTotal || 0) * 0.05);
    this.user.bonusPoints = (this.user.bonusPoints || 0) + earned;
    this.saveUser();
    this.renderAccountWidget();
    return earned;
  }

  spendBonus(amount) {
    if (!this.user) return 0;
    const spend = Math.min(this.user.bonusPoints || 0, Math.max(0, Number(amount) || 0));
    this.user.bonusPoints -= spend;
    this.saveUser();
    this.renderAccountWidget();
    return spend;
  }

  // Задания 97–100: Трекер цели чтения на год
  incrementBooksRead() {
    this.readingGoal.completed += 1;
    this.saveGoal();
    this.renderReadingTracker();
    showToast("Оқылған кітап қосылды!");
  }

  setYearlyTarget(newTarget) {
    const val = Math.max(1, Math.min(200, Number(newTarget) || 12));
    this.readingGoal.target = val;
    this.saveGoal();
    this.renderReadingTracker();
  }

  renderReadingTracker() {
    const box = document.querySelector("#reading-tracker-box");
    if (!box) return;

    const pct = Math.min(100, Math.round((this.readingGoal.completed / this.readingGoal.target) * 100));
    box.innerHTML = `
      <div class="tracker-card">
        <h3>Жылдық оқу мақсаты: ${this.readingGoal.completed} / ${this.readingGoal.target} кітап (${pct}%)</h3>
        <div class="progress-bar-wrap" style="background: var(--color-border); height: 12px; border-radius: 999px; overflow: hidden; margin: 0.75rem 0;">
          <div style="width: ${pct}%; height: 100%; background: var(--color-primary); transition: width 0.3s ease;"></div>
        </div>
        <div class="card-actions">
          <button type="button" id="add-read-book-btn" class="btn">+1 кітап оқыдым</button>
          <input type="number" id="goal-target-input" min="1" max="200" value="${this.readingGoal.target}" style="width: 80px; padding: 0.4rem;">
          <button type="button" id="save-goal-btn" class="btn-outline">Мақсатты сақтау</button>
        </div>
      </div>
    `;

    box.querySelector("#add-read-book-btn")?.addEventListener("click", () => this.incrementBooksRead());
    box.querySelector("#save-goal-btn")?.addEventListener("click", () => {
      const inp = box.querySelector("#goal-target-input");
      this.setYearlyTarget(inp?.value);
      showToast("Жылдық мақсат жаңартылды");
    });
  }

  renderAccountWidget() {
    const badge = document.querySelector("#user-account-badge");
    if (badge) {
      badge.textContent = this.user ? `${this.user.name} (${this.user.bonusPoints} Б)` : "Кіру";
    }

    const panel = document.querySelector("#user-profile-panel");
    if (!panel) return;

    if (!this.user) {
      panel.innerHTML = `
        <form id="user-login-form" class="checkout-box">
          <h3>Жеке кабинетке кіру</h3>
          <div class="form-group">
            <label for="login-name">Аты-жөніңіз</label>
            <input type="text" id="login-name" placeholder="Айдана Серікова" required>
          </div>
          <div class="form-group">
            <label for="login-email">Email</label>
            <input type="email" id="login-email" placeholder="aidana@mail.kz" required>
          </div>
          <button type="submit" class="btn">Кіру / Тіркелу</button>
        </form>
      `;

      panel.querySelector("#user-login-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const res = this.login({
          name: panel.querySelector("#login-name")?.value,
          email: panel.querySelector("#login-email")?.value
        });
        showToast(res.message);
      });
    } else {
      panel.innerHTML = `
        <div class="checkout-box">
          <h3>Профиль: ${this.user.name}</h3>
          <p class="muted">Email: ${this.user.email} · Тіркелген күні: ${this.user.joinedAt}</p>
          <p><strong>Жинақталған бонустар:</strong> ${this.user.bonusPoints} ₸</p>
          <button type="button" id="user-logout-btn" class="btn-outline">Шығу</button>
        </div>
      `;
      panel.querySelector("#user-logout-btn")?.addEventListener("click", () => this.logout());
    }

    this.renderReadingTracker();
  }
}