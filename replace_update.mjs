import fs from 'fs';
let content = fs.readFileSync('App.tsx', 'utf-8');
content = content.replace(/updateConfig=\{\(d\) => supabase\.from\("config"\)\.update\(\{ data: cleanData\(d\) \}\)\.eq\("id", "global"\)\}/g, 'updateConfig={updateConfig}');
fs.writeFileSync('App.tsx', content);
