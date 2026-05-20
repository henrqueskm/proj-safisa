import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// remove firebase imports
content = content.replace(/import \{ initializeApp \} from "firebase\/app";\n/, '');
content = content.replace(/import \{ getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc \} from "firebase\/firestore";\n/, "import { createClient } from '@supabase/supabase-js';\n");

// replace db initialization
content = content.replace(/\/\/ Initialize Firebase \([\s\S]+?const db = getFirestore\(appFirebase\);/g, `
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseKey);
`);

// 1. Obter todas
content = content.replace(/const snapshot = await getDocs\(collection\(db, "assembledUnits"\)\);\n\s*const units = snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g, `const { data } = await supabase.from("assembledunits").select('*');\n      const units = data ? data.map((d: any) => ({ ...d.data, id: d.id })) : [];`);

// 2. Adicionar
content = content.replace(/const docRef = await addDoc\(collection\(db, "assembledUnits"\), newUnit\);\n\s*res\.status\(201\)\.json\(\{ id: docRef\.id, \.\.\.newUnit \}\);/g, `const id = crypto.randomUUID(); await supabase.from("assembledunits").insert({ id, data: newUnit });\n      res.status(201).json({ id, ...newUnit });`);

// 3. Atualizar
content = content.replace(/await updateDoc\(doc\(db, "assembledUnits", id\), updatedData\);/g, `await supabase.from("assembledunits").update({ data: updatedData }).eq("id", id);`);

// 4. Deletar
content = content.replace(/await deleteDoc\(doc\(db, "assembledUnits", id\)\);/g, `await supabase.from("assembledunits").delete().eq("id", id);`);

// 5. Obter kits
content = content.replace(/const snapshot = await getDocs\(collection\(db, "kits"\)\);\n\s*const kits = snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g, `const { data } = await supabase.from("kits").select('*');\n      const kits = data ? data.map((d: any) => ({ ...d.data, id: d.id })) : [];`);

// 6. Adicionar kit
content = content.replace(/const docRef = await addDoc\(collection\(db, "kits"\), newKit\);\n\s*res\.status\(201\)\.json\(\{ id: docRef\.id, \.\.\.newKit \}\);/g, `const id = crypto.randomUUID(); await supabase.from("kits").insert({ id, data: newKit });\n      res.status(201).json({ id, ...newKit });`);

// 7. Atualizar kit
content = content.replace(/await updateDoc\(doc\(db, "kits", id\), updatedData\);/g, `await supabase.from("kits").update({ data: updatedData }).eq("id", id);`);

// 8. Deletar kit
content = content.replace(/await deleteDoc\(doc\(db, "kits", id\)\);/g, `await supabase.from("kits").delete().eq("id", id);`);

// 9. relatorio despachados
content = content.replace(/const snapshot = await getDocs\(collection\(db, "orders"\)\);\n\s*const orders = snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) as any \}\)\);/g, `const { data } = await supabase.from("orders").select('*');\n      const orders = data ? data.map((d: any) => ({ ...d.data, id: d.id })) : [];`);

// 10. exportar banco
content = content.replace(/const snapshot = await getDocs\(collection\(db, collectionName\)\);\n\s*exportData\[collectionName\] = snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g, `const { data } = await supabase.from(collectionName.toLowerCase()).select('*');\n        exportData[collectionName] = data ? data.map((d: any) => ({ ...d.data, id: d.id })) : [];`);

content = content.replace(/const configDoc = await getDoc\(doc\(db, "config", "global"\)\);\n\s*if \(configDoc\.exists\(\)\) \{\n\s*exportData\["config"\] = \[\{ id: configDoc\.id, \.\.\.configDoc\.data\(\) \}\];\n\s*\}/g, `const { data: configData } = await supabase.from("config").select('*').eq("id", "global");\n      if (configData && configData.length > 0) {\n        exportData["config"] = [{ ...configData[0].data, id: "global" }];\n      }`);

fs.writeFileSync('server.ts', content);

console.log("server.ts modified");
