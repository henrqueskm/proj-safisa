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
  content = content.replace(/group\.items\.every\(/g, '(group.items || []).every(');
  content = content.replace(/items\.every\(/g, '(items || []).every(');
  content = content.replace(/orderGroup\.items\.map\(/g, '(orderGroup.items || []).map(');
  content = content.replace(/group\.items\.map\(/g, '(group.items || []).map(');
  
  content = content.replace(/order\.items\.length > 0/g, '(order.items || []).length > 0');
  content = content.replace(/orderGroup\.items\.length/g, '(orderGroup.items || []).length');
  content = content.replace(/order\.items\.length/g, '(order.items || []).length');

  content = content.replace(/order\.items\.find\(/g, '(order.items || []).find(');
  
  content = content.replace(/items\.forEach\(/g, '(items || []).forEach(');
  
  content = content.replace(/orderToSave\.items\.length/g, '(orderToSave.items || []).length');

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Replaced more items accesses in ${file}`);
});
