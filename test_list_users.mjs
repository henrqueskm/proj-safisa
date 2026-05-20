import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vtdyixpydxeylwhawxst.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'no-key'
);

async function run() {
  const { data: fetchList } = await supabase.from('users').select('*');
  console.log('Users in DB now:', JSON.stringify(fetchList, null, 2));
}
run();
