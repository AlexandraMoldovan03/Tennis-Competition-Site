import { supabase } from './lib/supabase.js';

(async function init() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = '/dashboard.html';
      return;
    }
  } catch (e) {
    console.error('getSession error:', e);
  }

  const form = document.querySelector('#loginForm');
  const email = document.querySelector('#email');
  const pass  = document.querySelector('#pass');
  const msg   = document.querySelector('#msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = 'Se verifică...';
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: pass.value
      });
      if (error) {
        msg.textContent = error.message;
        return;
      }
      window.location.href = '/dashboard.html';
    } catch (err) {
      console.error(err);
      msg.textContent = 'Eroare de autentificare.';
    }
  });
})();
