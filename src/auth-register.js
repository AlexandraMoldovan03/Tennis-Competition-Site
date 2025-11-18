import { supabase } from './lib/supabase.js';

(function init() {
  const form  = document.querySelector('#regForm');
  const email = document.querySelector('#email');
  const pass  = document.querySelector('#pass');
  const msg   = document.querySelector('#msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = 'Se creează contul...';
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: pass.value
      });
      if (error) {
        msg.textContent = error.message;
        return;
      }
      // profil minim (opțional; va funcționa doar dacă RLS permite)
      if (data?.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email
        });
      }
      msg.textContent = 'Cont creat! Te poți autentifica.';
      setTimeout(() => { window.location.href = '/login.html'; }, 800);
    } catch (err) {
      console.error(err);
      msg.textContent = 'Eroare la înregistrare.';
    }
  });
})();
