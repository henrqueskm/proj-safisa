import fs from 'fs';

let content = fs.readFileSync('App.tsx', 'utf-8');

content = content.replace(/from\("kitImages"\)/g, 'from("kitimages")');
content = content.replace(/from\("kitData"\)/g, 'from("kitdata")');
content = content.replace(/from\("servoModelData"\)/g, 'from("servomodeldata")');
content = content.replace(/from\("assembledUnits"\)/g, 'from("assembledunits")');
content = content.replace(/from\("auditLogs"\)/g, 'from("auditlogs")');

fs.writeFileSync('App.tsx', content);

let hm = fs.readFileSync('hooks/useOrderManagement.ts', 'utf-8');
hm = hm.replace(/from\('kitImages'\)/g, "from('kitimages')");
hm = hm.replace(/from\('kitData'\)/g, "from('kitdata')");
hm = hm.replace(/from\('servoModelData'\)/g, "from('servomodeldata')");
hm = hm.replace(/from\('assembledUnits'\)/g, "from('assembledunits')");
hm = hm.replace(/from\('auditLogs'\)/g, "from('auditlogs')");
fs.writeFileSync('hooks/useOrderManagement.ts', hm);

console.log("Lowercased tables");
