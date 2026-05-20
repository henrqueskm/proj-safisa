import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vtdyixpydxeylwhawxst.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'no-key'
);

async function run() {
  const user = { id: 'test_user_1', name: 'Test User', username: 'testuser', role: 'ADMIN' };
  console.log('Upserting user...');
  const { data, error } = await supabase.from('users').upsert({ id: user.id, data: user });
  console.log('Result:', { data, error });
  
  const { data: fetchList } = await supabase.from('users').select('*');
  console.log('Users in DB now:', fetchList?.length);
}
run();
