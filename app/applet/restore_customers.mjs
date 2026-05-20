import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vtdyixpydxeylwhawxst.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'no-key';

if (supabaseKey === 'no-key') {
  console.log("No valid anon key provided");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching orders to build customers list...");
  const { data: dbOrders, error: orderErr } = await supabase.from('orders').select('*');
  
  if (orderErr) {
    console.error("Error fetching orders:", orderErr);
    return;
  }
  
  const orders = dbOrders.map(d => ({ ...d.data, id: d.id }));
  
  const customersMap = new Map();
  
  orders.forEach(order => {
      const name = order.customerName?.trim();
      const lowerName = name?.toLowerCase();
      
      if (!name) return;
      
      const purchaseTime = new Date(order.createdAt || 0).getTime();
      
      if (!customersMap.has(lowerName)) {
         customersMap.set(lowerName, {
            id: crypto.randomUUID(),
            name: name,
            city: order.city || "",
            carrier: order.carrier || "",
            representative: order.representative || "",
            lastPurchaseAt: purchaseTime
         });
      } else {
         const existing = customersMap.get(lowerName);
         if (purchaseTime > existing.lastPurchaseAt) {
             existing.lastPurchaseAt = purchaseTime;
         }
      }
  });
  
  const extractedCustomers = Array.from(customersMap.values());
  console.log(`Extracted ${extractedCustomers.length} unique customers from orders.`);
  
  // Fetch existing customers
  const { data: dbCustomers, error: custErr } = await supabase.from('customers').select('*');
  const existingCustomers = (dbCustomers || []).map(d => ({ ...d.data, id: d.id }));
  
  const existingMap = new Map();
  existingCustomers.forEach(c => existingMap.set(c.name?.trim().toLowerCase(), c));
  
  const toUpsert = [];
  
  extractedCustomers.forEach(extC => {
      if (!existingMap.has(extC.name.toLowerCase())) {
          toUpsert.push({
              id: extC.id,
              data: extC
          });
      }
  });
  
  console.log(`Found ${toUpsert.length} customers to insert.`);
  
  for (let i = 0; i < toUpsert.length; i += 20) {
      const chunk = toUpsert.slice(i, i + 20);
      const { error } = await supabase.from('customers').upsert(chunk);
      if (error) console.error("Error upserting chunk", error);
  }
  
  console.log("Done inserting missing customers.");
}

run();
