
import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = 'https://wguckoihzasopcbalsia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndWNrb2loemFzb3BjYmFsc2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTIxMjgsImV4cCI6MjA3ODQ4ODEyOH0.ivWWLMAKoRWdbrnvozXvj8fimhu2-acABkRlg_CJfBU';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase credentials missing');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
