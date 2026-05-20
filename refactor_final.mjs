import fs from 'fs';

// 1. AssemblyView.tsx
let av = fs.readFileSync('components/AssemblyView.tsx', 'utf-8');
av = av.replace(/import \{ db, collection, addDoc \} from '\.\.\/firebase';\n/, '');
fs.writeFileSync('components/AssemblyView.tsx', av);

// 2. ExpeditionView.tsx
let ev = fs.readFileSync('components/ExpeditionView.tsx', 'utf-8');
ev = ev.replace(/import \{ db, collection, addDoc, updateDoc, doc \} from '\.\.\/firebase';/, "import { supabase } from '../supabase';");
ev = ev.replace(/updateDoc\(doc\(db,\s*"([^"]+)",\s*([^)]+)\),\s*([^)]+)\)/g, 'supabase.from("$1").update({ data: $3 }).eq("id", $2)');
ev = ev.replace(/addDoc\(collection\(db,\s*'([^']+)'\),\s*([^)]+)\)/g, 'supabase.from("$1").insert({ id: crypto.randomUUID(), data: $2 })');
fs.writeFileSync('components/ExpeditionView.tsx', ev);

// 3. useAuthentication.ts
let au = fs.readFileSync('hooks/useAuthentication.ts', 'utf-8');
au = au.replace(/import \{ db, doc, updateDoc, collection, addDoc \} from '\.\.\/firebase';/, "import { supabase } from '../supabase';");
au = au.replace(/updateDoc\(doc\(db,\s*"([^"]+)",\s*([^)]+)\),\s*([^)]+)\)/g, 'supabase.from("$1").update({ data: $3 }).eq("id", $2)');
au = au.replace(/updateDoc\(doc\(db,\s*"([^"]+)",\s*([^)]+)\),\s*([\s\S]+?)\)/g, 'supabase.from("$1").update({ data: $3 }).eq("id", $2)'); // handle multi-line

// handle the specific multiline
au = au.replace(/updateDoc\(doc\(db, "users", loggedInUser.id\), \{\s*isOnline: false\s*\}\);/g, 'supabase.from("users").update({ data: { isOnline: false } }).eq("id", loggedInUser.id);');
au = au.replace(/updateDoc\(doc\(db, "users", loggedInUser\.id\), \{\s*isOnline: true,\s*lastSeen: Date\.now\(\)\s*\}\);/g, 'supabase.from("users").update({ data: { isOnline: true, lastSeen: Date.now() } }).eq("id", loggedInUser.id);');

au = au.replace(/addDoc\(collection\(db,\s*"([^"]+)"\),\s*([^)]+)\)/g, 'supabase.from("$1").insert({ id: crypto.randomUUID(), data: $2 })');
// there is multi-line addDoc!
au = au.replace(/addDoc\(collection\(db, "auditLogs"\), \{([\s\S]+?)\}\);/g, 'supabase.from("auditlogs").insert({ id: crypto.randomUUID(), data: {$1} });');

fs.writeFileSync('hooks/useAuthentication.ts', au);

console.log("Cleanup down to 0 firebase imports");
