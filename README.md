# Auth Module — Kirish va Ro'yxatdan o'tish

Framework talab qilmaydigan (HTML + CSS + vanilla JS) qayta ishlatiladigan autentifikatsiya moduli. O'zbek tilidagi interfeys, `+998` telefon formati, parol kuchi ko'rsatkichi, urinishlar limiti va sessiya muddati bilan.

## Tuzilma
```
auth-module/
├── index.html
├── css/auth.css
└── js/
    ├── auth.js   # mantiq (API)
    └── ui.js     # forma bilan ishlash
```

## Loyihaga ulash
1. `css/` va `js/` papkalarini loyihaga ko'chiring, `index.html` dagi formani sahifangizga qo'shing.
2. `js/auth.js` boshidagi `CONFIG` ni sozlang (`storagePrefix`, `redirectTo`).
3. Ranglar uchun `css/auth.css` dagi `--auth-*` o'zgaruvchilarni o'zgartiring.

### Himoyalangan sahifa
```html
<script src="js/auth.js"></script>
<script>
  if (Auth.requireAuth('index.html')) {
    document.title = Auth.currentUser().name;
  }
</script>
```
Chiqish: `Auth.logout(); location.href = 'index.html';`

## Backend ulash
Hozir ma'lumotlar `localStorage` da saqlanadi (demo / frontend loyihalar uchun). Haqiqiy server uchun `Auth.setAdapter({...})` orqali `findUser`, `createUser`, `getSession`, `setSession`, `getAttempts`, `setAttempts` metodlarini API chaqiruvlariga almashtiring.

## Xavfsizlik eslatmasi
Parollar PBKDF2 (SHA-256, 120 000 iteratsiya) bilan xeshlanadi, ammo brauzerdagi autentifikatsiya haqiqiy himoya emas. Ishlab chiqarish (production) uchun tekshiruv serverda (HTTPS, httpOnly cookie/JWT) bo'lishi shart.

## Litsenziya
MIT
