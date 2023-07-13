import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types/supabase'
const supabase: SupabaseClient = createClient<Database>('https://uumbjbosyllctxqzzrja.supabase.co', process.env.SUPABASE_KEY!, { auth: { persistSession: false } });

async function findEmail(phone: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('email')
    .eq('phone', phone);

  if (data === null) return null;

  if (data.length == 0) {
    return null;
  } else {
    return data[0].email;
  }
}

async function insertIdea(transcription: string, llm_summary: string, phone: string) {
  const insertRes: any = await supabase.from("ideas")
    .insert({ transcription, llm_summary, phone })
    .select();

  return insertRes.data[0].id;
}

async function updateSentAt(id: number, sent_to_email_at: Date) {
  return supabase.from("ideas")
    .update({ sent_to_email_at })
    .eq("id", id);
}

async function updateEmail(phone: string, oldEmail: string, newEmail: string) {
  if (oldEmail) {
    console.log('not found phone');
    return await supabase.from('accounts').insert({ phone: phone, email: newEmail });
  }

  return await supabase.from('accounts').update({ email: oldEmail }).eq('phone', phone);
}

export { findEmail, insertIdea, updateSentAt, updateEmail };