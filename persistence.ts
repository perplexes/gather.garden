import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from 'types/supabase'
const supabase: SupabaseClient = createClient<Database>('https://uumbjbosyllctxqzzrja.supabase.co', process.env.SUPABASE_KEY!, { auth: { persistSession: false } });

async function findEmail(phone: string){
  const { data, error } = await supabase
    .from('accounts')
    .select('email')
    .eq('phone', phone);
  if (data.length = 0){
    return null;
  }
  
  return data[0].email;
}

export { findEmail };