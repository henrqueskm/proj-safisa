import fs from 'fs';

let content = fs.readFileSync('App.tsx', 'utf-8');

// replace the firebase import
content = content.replace(/import \{ db, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, getDocs, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, uploadFile \} from '\.\/firebase';/, "import { supabase } from './supabase';\nimport { uploadFile } from './supabaseStorage';");

// updateDoc(doc(db, "table", id), obj)  -> supabase.from("table").update({ data: obj }).eq("id", id)
content = content.replace(/updateDoc\(doc\(db,\s*"([^"]+)",\s*([^)]+)\),\s*(cleanData\([^)]+\)|{[^}]*}|[^)]+)\)/g, 'supabase.from("$1").update({ data: $3 }).eq("id", $2)');

// second pass just in case
content = content.replace(/updateDoc\(doc\(db,\s*"([^"]+)",\s*([^)]+)\),\s*(.+)\)/g, 'supabase.from("$1").update({ data: $3 }).eq("id", $2)');

// setDoc(doc(db, "table", id), obj) -> supabase.from("table").upsert({ id: $2, data: $3 })
content = content.replace(/setDoc\(doc\(db,\s*"([^"]+)",\s*([^)]+)\),\s*(.+)\)/g, 'supabase.from("$1").upsert({ id: $2, data: $3 })');

// deleteDoc(doc(db, "table", id)) -> supabase.from("table").delete().eq("id", $2)
content = content.replace(/deleteDoc\(doc\(db,\s*"([^"]+)",\s*([^)]+)\)\)/g, 'supabase.from("$1").delete().eq("id", $2)');

fs.writeFileSync('App.tsx', content);

let exportContent = `
import { supabase } from './supabase';

export const uploadFile = async (bucket, path, file) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
};
`;
fs.writeFileSync('supabaseStorage.ts', exportContent);

console.log("Refactor applied to App.tsx");
