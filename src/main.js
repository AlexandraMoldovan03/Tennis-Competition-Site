import './style.css';
import { supabase } from './lib/supabase.js';

// ----------------- FOOTER: ANUL CURENT -----------------
const yearEl = document.querySelector('#year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// ----------------- MOBILE MENU -----------------
const toggle = document.querySelector('.nav__toggle');
const menu = document.querySelector('[data-menu]');

if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('show');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// ----------------- AUTH (MODAL) -----------------
const authModal = document.querySelector('#authModal');
const btnLogin = document.querySelector('#btnLogin');       
const btnDashboard = document.querySelector('#btnDashboard');
const authForm = document.querySelector('#authForm');
const authEmail = document.querySelector('#authEmail');
const authPass = document.querySelector('#authPass');
const authTitle = document.querySelector('#authTitle');

let mode = 'login'; 

function openAuth() {
  if (!authModal) return;
  authModal.classList.remove('is-hidden');
  document.body.style.overflow = 'hidden';
}

function closeAuth() {
  if (!authModal) return;
  authModal.classList.add('is-hidden');
  document.body.style.overflow = '';
}


if (btnLogin && authModal) {
  btnLogin.addEventListener('click', (e) => {
    e.preventDefault();
    openAuth();
  });
}

// Close (X + backdrop)
authForm?.querySelector('.auth__close')?.addEventListener('click', (e) => {
  e.preventDefault();
  closeAuth();
});
authModal?.querySelector('[data-close]')?.addEventListener('click', (e) => {
  e.preventDefault();
  closeAuth();
});

// Tabs (Login / Register) – doar dacă există formularul și titlul
if (authForm && authTitle) {
  authForm.querySelectorAll('.auth__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      authForm
        .querySelectorAll('.auth__tab')
        .forEach((t) => t.classList.remove('auth__tab--active'));
      tab.classList.add('auth__tab--active');
      mode = tab.dataset.mode;
      authTitle.textContent = mode === 'login' ? 'Login' : 'Register';
    });
  });

  // Submit login/register
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail?.value.trim();
    const password = authPass?.value;

    if (!email || !password) return;

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Cont creat! Te poți autentifica acum.');
        mode = 'login';
        const firstTab = authForm.querySelectorAll('.auth__tab')[0];
        firstTab?.click();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        closeAuth();
        window.location.href = '/dashboard.html';
      }
    } catch (err) {
      alert(err.message || 'Eroare de autentificare');
    }
  });
}

// ----------------- STARE SESIUNE -----------------
async function refreshAuthUI() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  
  if (btnDashboard) {
    btnDashboard.style.display = session ? '' : 'none';
  }

  
  if (!btnLogin) return;

  if (session) {
    btnLogin.textContent = 'Logout';
    btnLogin.classList.remove('btn--primary');
    btnLogin.classList.add('btn--ghost');
    btnLogin.onclick = async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    };
  } else {
    btnLogin.textContent = 'Login';
    btnLogin.classList.add('btn--primary');
    btnLogin.onclick = (e) => {
      
      if (authModal) {
        e.preventDefault();
        openAuth();
      }
    };
  }
}

refreshAuthUI();
supabase.auth.onAuthStateChange(() => {
  refreshAuthUI();
});

// ----------------- LISTĂ TURNEE (DEMO) -----------------
const list = document.querySelector('#tournamentsList');
if (list) {
  list.innerHTML = [
    { name: 'Open Alba Iulia', cats: 'U14, U16, Seniori', when: '27–29 iun' },
    { name: 'Cluj Cup', cats: 'U12, U18', when: '12–14 iul' },
    { name: 'Timișoara Masters', cats: 'Seniori', when: '2–4 aug' },
  ]
    .map(
      (t) => `
      <article class="card">
        <h3>${t.name}</h3>
        <p>${t.cats}</p>
        <small style="color:#aeb3bd">📅 ${t.when}</small>
        <a href="#" class="btn btn--ghost" style="margin-top:auto">Detalii</a>
      </article>
    `,
    )
    .join('');
}
