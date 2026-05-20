import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vtdyixpydxeylwhawxst.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'no-key'
);

async function run() {
  const { data, error } = await supabase.from('assembledunits').select('*');
  const unassigned = data.map(d => d.data).filter(u => !u.isAssigned);
  console.log('Currently unassigned units:', unassigned.length);
}
run();
