import fs from 'fs';

const files = [
  'components/AdminView.tsx',
  'components/ExpeditionView.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/i\.guaranteeNumber\?\.toUpperCase\(\)/g, "safeToUpper(i.guaranteeNumber)");
  fs.writeFileSync(file, content);
}
console.log('Replaced');
