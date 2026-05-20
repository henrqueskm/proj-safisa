import fs from 'fs';

const files = [
  'components/AdminView.tsx',
  'components/AssemblyView.tsx',
  'components/Chat.tsx',
  'components/ExpeditionView.tsx',
  'components/SystemSettingsModal.tsx',
  'App.tsx',
  'hooks/useOrderManagement.ts'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  
  // ensure safeToUpper is imported if we are about to use it
  if (!content.includes('safeToUpper')) {
    if (content.includes('import { safeFormatDate }')) {
      content = content.replace('import { safeFormatDate } from', 'import { safeFormatDate, safeToUpper } from');
    } else if (content.includes('import { cn } from')) {
      content = content.replace('import { cn } from', 'import { cn, safeToUpper } from');
    } else {
        const importPath = file.startsWith('components/') || file.startsWith('hooks/') ? '../lib/utils' : './lib/utils';
        content = `import { safeToUpper } from '${importPath}';\n` + content;
    }
  }

  // regex to replace things like `o.customerName.toUpperCase()` -> `safeToUpper(o.customerName)`
  // it should handle letters, digits, dots and optional brackets
  content = content.replace(/([a-zA-Z0-9_\.]+(?:\[[^\]]+\])?(?:\?\.)?)\.toUpperCase\(\)/g, (match, p1) => {
    // we want to avoid replacing simple strings like 'OUTROS'.toUpperCase()
    if (p1.startsWith("'") || p1.startsWith('"') || p1.startsWith('`')) return match;
    // avoid replacing Math.random().toString().substr().toUpperCase()
    if (p1.includes('substr') || p1.includes('padStart') || p1.includes('trim()') || p1.includes('split') || p1.includes('Math') || p1.includes('charAt')) return match; 
    
    // We already handled representative in useOrderManagement, let's keep going.
    return `safeToUpper(${p1})`;
  });
  
  // let's explicitly handle trim().toUpperCase()
  content = content.replace(/([a-zA-Z0-9_\.]+)\.trim\(\)\.toUpperCase\(\)/g, "safeToUpper($1).trim()");

  fs.writeFileSync(file, content);
}
console.log('Replaced toUpperCase');
