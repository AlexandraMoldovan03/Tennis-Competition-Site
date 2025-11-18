
import { supabase } from './lib/supabase.js';

async function ensureAuth(){
  const { data: { session } } = await supabase.auth.getSession();
  if(!session){
    
    window.location.href = '/';
    return;
  }
  document.querySelector('#who').textContent = session.user.email;
}
ensureAuth();

document.querySelector('#btnLogout')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  await supabase.auth.signOut();
  window.location.href = '/';
});
