import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vtdyixpydxeylwhawxst.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'no-key'
);

async function run() {
  const { data, error } = await supabase.from('users').select('*');
  console.log('Error:', error);
  console.log('Users count:', data?.length);
  if (data) {
    console.log(data);
  }
}
run();
