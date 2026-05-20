import fs from 'fs';

let content = fs.readFileSync('components/ExpeditionView.tsx', 'utf-8');
content = content.replace(/normalizeKitName\(([^)]+)\)\.toUpperCase\(\)/g, "safeToUpper(normalizeKitName($1))");
if (!content.includes('safeToUpper')) {
  content = `import { safeToUpper } from '../lib/utils';\n` + content;
}
fs.writeFileSync('components/ExpeditionView.tsx', content);

content = fs.readFileSync('App.tsx', 'utf-8');
content = content.replace(/normalizeKitName\(([^)]+)\)\.toUpperCase\(\)/g, "safeToUpper(normalizeKitName($1))");
if (!content.includes('safeToUpper') && content.includes('normalizeKitName')) {
  content = `import { safeToUpper } from './lib/utils';\n` + content;
}
fs.writeFileSync('App.tsx', content);

content = fs.readFileSync('hooks/useOrderManagement.ts', 'utf-8');
content = content.replace(/normalizeKitName\(([^)]+)\)\.toUpperCase\(\)/g, "safeToUpper(normalizeKitName($1))");
fs.writeFileSync('hooks/useOrderManagement.ts', content);

console.log('Fixed normalizeKitName');
