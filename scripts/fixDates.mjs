import fs from 'fs';

const files = [
  'App.tsx',
  'components/AdminView.tsx',
  'components/AssemblyView.tsx',
  'components/Chat.tsx',
  'components/ExpeditionView.tsx',
  'components/SystemSettingsModal.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  if (!content.includes('safeFormatDate')) {
    if (content.includes('import { cn } from "../lib/utils";')) {
      content = content.replace('import { cn } from "../lib/utils";', 'import { cn, safeFormatDate } from "../lib/utils";');
    } else if (content.includes('import { cn } from "./lib/utils";')) {
      content = content.replace('import { cn } from "./lib/utils";', 'import { cn, safeFormatDate } from "./lib/utils";');
    }
  }

  // AdminView & others
  content = content.replace(/new Date\(o\.createdAt\)\.toISOString\(\)\.split\('T'\)\[0\]/g, "safeFormatDate(o.createdAt, 'iso')");
  content = content.replace(/new Date\(o\.dispatchedAt\)\.toISOString\(\)\.split\('T'\)\[0\]/g, "safeFormatDate(o.dispatchedAt, 'iso')");
  content = content.replace(/new Date\(o\.createdAt\)\.toLocaleDateString\('pt-BR'\)/g, "safeFormatDate(o.createdAt)");
  content = content.replace(/new Date\(o\.dispatchedAt\)\.toLocaleDateString\('pt-BR'\)/g, "safeFormatDate(o.dispatchedAt)");
  content = content.replace(/new Date\(o\.dispatchedAt \|\| 0\)\.toLocaleDateString\(\)/g, "safeFormatDate(o.dispatchedAt)");
  
  content = content.replace(/new Date\(order\.createdAt\)\.toLocaleDateString\(\)/g, "safeFormatDate(order.createdAt)");
  content = content.replace(/new Date\(o\.createdAt\)\.toLocaleDateString\(\)/g, "safeFormatDate(o.createdAt)");
  
  // Chat
  content = content.replace(/new Date\(msg\.timestamp\)\.toLocaleTimeString\(\[\]\, \{ hour\: '2-digit'\, minute\: '2-digit' \}\)/g, "safeFormatDate(msg.timestamp, 'time')");

  // SystemSettingsModal - fallback for toLocaleString
  content = content.replace(/new Date\(log\.timestamp\)\.toLocaleString\('pt-BR'\)/g, "safeFormatDate(log.timestamp) + ' ' + safeFormatDate(log.timestamp, 'time')");
  
  // AssemblyView
  content = content.replace(/new Date\(u\.assemblyDate\)\.toLocaleDateString\(\)/g, "safeFormatDate(u.assemblyDate)");

  fs.writeFileSync(file, content);
}
console.log("Replaced");
