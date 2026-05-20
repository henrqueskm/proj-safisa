import fs from 'fs';

const files = [
  'App.tsx',
  'components/AdminView.tsx',
  'components/ExpeditionView.tsx',
  'components/AssemblyView.tsx',
  'hooks/useOrderManagement.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/o\.items\.filter\(/g, '(o.items || []).filter(');
  content = content.replace(/order\.items\.filter\(/g, '(order.items || []).filter(');
  content = content.replace(/group\.items\.filter\(/g, '(group.items || []).filter(');
  content = content.replace(/orderGroup\.items\.filter\(/g, '(orderGroup.items || []).filter(');
  content = content.replace(/currentBatchGroup\.items\.filter\(/g, '(currentBatchGroup.items || []).filter(');
  content = content.replace(/currentPrintGroup\.items\.filter\(/g, '(currentPrintGroup.items || []).filter(');
  
  content = content.replace(/items\.filter\(/g, '(items || []).filter(');

  content = content.replace(/o\.items\.length/g, '(o.items || []).length');
  content = content.replace(/group\.items\.length/g, '(group.items || []).length');
  
  content = content.replace(/curr\.items\.filter\(/g, '(curr.items || []).filter(');
  content = content.replace(/curr\.items\.length/g, '(curr.items || []).length');
  
  content = content.replace(/order\.items\.forEach\(/g, '(order.items || []).forEach(');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Replaced in ${file}`);
});
