import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vtdyixpydxeylwhawxst.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'no-key'
);

async function run() {
  const { data: allOrdersData } = await supabase.from('orders').select('data');
  if (!allOrdersData) return;

  const assignedGuarantees = new Set();
  allOrdersData.forEach(o => {
    const order = o.data;
    if (order && order.items) {
      order.items.forEach((item) => {
        if (item.guaranteeNumber) {
          assignedGuarantees.add(String(item.guaranteeNumber));
        }
      });
    }
  });

  console.log('Assigned guarantees found:', assignedGuarantees.size);

  const { data: assembledUnits } = await supabase.from('assembledunits').select('*');
  const updates = [];

  assembledUnits.forEach(u => {
    const unit = u.data;
    const shouldBeAssigned = assignedGuarantees.has(String(unit.guaranteeNumber));
    if (unit.isAssigned !== shouldBeAssigned) {
      unit.isAssigned = shouldBeAssigned;
      updates.push(supabase.from('assembledunits').update({ data: unit }).eq('id', unit.id));
    }
  });

  console.log('Updates needed:', updates.length);
  const chunked = [];
  for(let i = 0; i < updates.length; i += 10) {
      chunked.push(updates.slice(i, i+10));
  }
  
  for(const chunk of chunked) {
      await Promise.all(chunk);
  }
  console.log('Done');
}
run();
