/*!
 * Auth — framework-siz, qayta ishlatiladigan autentifikatsiya moduli.
 * Hozir localStorage ishlatadi; backend ulanganda faqat `adapter` ni almashtiring.
 */
(function (global) {
  'use strict';

  const CONFIG = {
    storagePrefix: 'auth:',          // loyihalar to'qnashmasligi uchun o'zgartiring
    sessionHours: 24 * 7,
    maxAttempts: 5,
    lockMinutes: 5,
    minPassword: 8,
    redirectTo: 'dashboard.html'     // muvaffaqiyatli kirishdan keyin
  };

  /* ---------- Storage adapter (backend bilan almashtiriladi) ---------- */
  const localAdapter = {
    _get(k, d) { try { return JSON.parse(localStorage.getItem(CONFIG.storagePrefix + k)) ?? d; } catch { return d; } },
    _set(k, v) { localStorage.setItem(CONFIG.storagePrefix + k, JSON.stringify(v)); },
    async findUser(phone) { return this._get('users', []).find(u => u.phone === phone) || null; },
    async createUser(user) { const all = this._get('users', []); all.push(user); this._set('users', all); return user; },
    getSession() { return this._get('session', null); },
    setSession(s) { s ? this._set('session', s) : localStorage.removeItem(CONFIG.storagePrefix + 'session'); },
    getAttempts(phone) { return this._get('attempts', {})[phone] || { count: 0, until: 0 }; },
    setAttempts(phone, a) { const all = this._get('attempts', {}); a ? (all[phone] = a) : delete all[phone]; this._set('attempts', all); }
  };
  let adapter = localAdapter;

  /* ---------- Yordamchilar ---------- */
  const enc = new TextEncoder();
  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  async function hash(password, salt) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
    return toHex(bits);
  }
  const randomHex = n => toHex(crypto.getRandomValues(new Uint8Array(n)));

  /** Telefonni +998XXXXXXXXX ko'rinishiga keltiradi; noto'g'ri bo'lsa null */
  function normalizePhone(input) {
    let d = String(input || '').replace(/\D/g, '');
    if (d.length === 9) d = '998' + d;
    return /^998\d{9}$/.test(d) ? '+' + d : null;
  }
  function formatPhone(input) {
    let d = String(input || '').replace(/\D/g, '');
    if (d.startsWith('998')) d = d.slice(3);
    d = d.slice(0, 9);
    const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
    return '+998' + (p.length ? ' ' + p.join(' ') : '');
  }
  function passwordScore(pw) {
    let s = 0;
    if (pw.length >= CONFIG.minPassword) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^\w\s]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  class AuthError extends Error { constructor(message, field) { super(message); this.field = field; } }

  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn(Auth.currentUser()));

  /* ---------- Ommaviy API ---------- */
  const Auth = {
    config: CONFIG,
    setAdapter(a) { adapter = a; },
    normalizePhone, formatPhone, passwordScore, AuthError,

    async register({ name, phone, password, confirm }) {
      name = String(name || '').trim();
      const p = normalizePhone(phone);
      if (name.length < 2) throw new AuthError("Ism va familiyani kiriting.", 'name');
      if (!p) throw new AuthError("Telefon raqam noto'g'ri. Namuna: +998 90 123 45 67", 'phone');
      if (password.length < CONFIG.minPassword || !/[A-Za-z]/.test(password) || !/\d/.test(password))
        throw new AuthError(`Parol kamida ${CONFIG.minPassword} ta belgi, harf va raqamdan iborat bo'lsin.`, 'password');
      if (password !== confirm) throw new AuthError('Parollar mos kelmadi.', 'confirm');
      if (await adapter.findUser(p)) throw new AuthError("Bu raqam bilan hisob allaqachon mavjud. Kirish bo'limidan foydalaning.", 'phone');

      const salt = randomHex(16);
      const user = { id: randomHex(8), name, phone: p, salt, hash: await hash(password, salt), createdAt: Date.now() };
      await adapter.createUser(user);
      return this._startSession(user);
    },

    async login({ phone, password }) {
      const p = normalizePhone(phone);
      if (!p) throw new AuthError("Telefon raqam noto'g'ri.", 'phone');
      if (!password) throw new AuthError('Parolni kiriting.', 'password');

      const att = adapter.getAttempts(p);
      if (att.until > Date.now()) {
        const m = Math.ceil((att.until - Date.now()) / 60000);
        throw new AuthError(`Urinishlar ko'p bo'ldi. ${m} daqiqadan keyin qayta urinib ko'ring.`);
      }
      const user = await adapter.findUser(p);
      const ok = user && (await hash(password, user.salt)) === user.hash;
      if (!ok) {
        const count = att.count + 1;
        adapter.setAttempts(p, count >= CONFIG.maxAttempts
          ? { count: 0, until: Date.now() + CONFIG.lockMinutes * 60000 }
          : { count, until: 0 });
        throw new AuthError("Telefon raqam yoki parol noto'g'ri.");
      }
      adapter.setAttempts(p, null);
      return this._startSession(user);
    },

    _startSession(user) {
      const session = { userId: user.id, name: user.name, phone: user.phone, expires: Date.now() + CONFIG.sessionHours * 3600000 };
      adapter.setSession(session);
      emit();
      return session;
    },

    currentUser() {
      const s = adapter.getSession();
      if (!s) return null;
      if (s.expires < Date.now()) { adapter.setSession(null); return null; }
      return { id: s.userId, name: s.name, phone: s.phone };
    },
    isAuthenticated() { return !!this.currentUser(); },
    logout() { adapter.setSession(null); emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Himoyalangan sahifalar uchun: Auth.requireAuth('index.html') */
    requireAuth(loginUrl = 'index.html') {
      if (!this.isAuthenticated()) { location.replace(loginUrl); return false; }
      return true;
    }
  };

  global.Auth = Auth;
})(window);
