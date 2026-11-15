(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const forms = { login: $('#loginForm'), signup: $('#signupForm') };
  const texts = {
    login:  ['Hisobingizga kiring', 'Telefon raqamingiz va parolni kiriting.'],
    signup: ["Yangi hisob yarating", "Ma'lumotlaringizni kiriting, bir daqiqa kifoya."]
  };
  const alertBox = $('#alert');

  if (Auth.isAuthenticated()) location.replace(Auth.config.redirectTo);

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.classList.toggle('is-ok', !!ok);
    alertBox.hidden = !msg;
  }
  function clearErrors(form) {
    $$('.field', form).forEach(f => { f.classList.remove('is-invalid'); $('.field__err', f).textContent = ''; });
    showAlert('');
  }
  function fieldError(form, name, msg) {
    const input = form.elements[name]; if (!input) return showAlert(msg);
    const f = input.closest('.field'); f.classList.add('is-invalid');
    $('.field__err', f).textContent = msg; input.focus();
  }

  function switchTab(tab) {
    $$('.tabs__btn').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on);
    });
    Object.entries(forms).forEach(([k, f]) => (f.hidden = k !== tab));
    $('#title').textContent = texts[tab][0]; $('#subtitle').textContent = texts[tab][1];
    clearErrors(forms[tab]);
  }
  $$('.tabs__btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // Telefon formati
  $$('input[type="tel"]').forEach(i => i.addEventListener('input', () => { i.value = Auth.formatPhone(i.value); }));

  // Parolni ko'rsatish
  $$('.pw__toggle').forEach(btn => btn.addEventListener('click', () => {
    const input = $('input', btn.parentElement); const show = input.type === 'password';
    input.type = show ? 'text' : 'password'; btn.textContent = show ? 'Yashirish' : "Ko'rsatish";
  }));

  // Parol kuchi
  const meter = $('.meter i'), meterTxt = $('.meter__txt');
  const levels = [['0%', 'var(--auth-danger)', 'Kamida 8 ta belgi, harf va raqam.'], ['25%', 'var(--auth-danger)', 'Zaif parol'],
    ['50%', '#d97706', "O'rtacha parol"], ['75%', 'var(--auth-ok)', 'Yaxshi parol'], ['100%', 'var(--auth-ok)', 'Juda kuchli parol']];
  forms.signup.elements.password.addEventListener('input', e => {
    const v = e.target.value, [w, c, t] = levels[v ? Math.max(1, Auth.passwordScore(v)) : 0];
    meter.style.width = w; meter.style.background = c; meterTxt.textContent = t;
  });

  async function submit(kind, e) {
    e.preventDefault();
    const form = forms[kind], btn = $('.btn', form), label = btn.textContent;
    clearErrors(form);
    const data = Object.fromEntries(new FormData(form));
    btn.disabled = true; btn.textContent = 'Kuting…';
    try {
      await (kind === 'login' ? Auth.login(data) : Auth.register(data));
      showAlert(kind === 'login' ? 'Muvaffaqiyatli kirdingiz.' : 'Hisob yaratildi.', true);
      setTimeout(() => location.assign(Auth.config.redirectTo), 600);
    } catch (err) {
      if (!(err instanceof Auth.AuthError)) { console.error(err); return showAlert("Kutilmagan xatolik. Qayta urinib ko'ring."); }
      err.field ? fieldError(form, err.field, err.message) : showAlert(err.message);
    } finally { btn.disabled = false; btn.textContent = label; }
  }
  forms.login.addEventListener('submit', e => submit('login', e));
  forms.signup.addEventListener('submit', e => submit('signup', e));
})();
