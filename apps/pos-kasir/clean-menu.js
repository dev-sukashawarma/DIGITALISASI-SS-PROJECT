const fs = require('fs');

const path = 'c:\\Users\\AK\\Desktop\\shawarma-kiosk\\app\\kasir\\menu\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove FormState, EMPTY, and deleteStorageImage
content = content.replace(/interface FormState \{[\s\S]*?async function deleteStorageImage\(url: string\) \{[\s\S]*?\}\n/g, '');

// 2. Remove states related to form
content = content.replace(/  const \[form, setForm\].*\n/g, '');
content = content.replace(/  const \[showForm, setShowForm\].*\n/g, '');
content = content.replace(/  const \[saving, setSaving\].*\n/g, '');
content = content.replace(/  const \[uploading, setUploading\].*\n/g, '');
content = content.replace(/  const \[error, setError\].*\n/g, '');
content = content.replace(/  const \[imageFile, setImageFile\].*\n/g, '');
content = content.replace(/  const \[preview, setPreview\].*\n/g, '');
content = content.replace(/  const fileRef = useRef<HTMLInputElement>\(null\)\n/g, '');

// 3. Remove resetImage to handleSave
content = content.replace(/  function resetImage\(\) \{[\s\S]*?async function handleSave\(e: React.FormEvent\) \{[\s\S]*?setSaving\(false\)\n  \}\n/g, '');

// 4. Remove deleteItem and displayImage
content = content.replace(/  async function deleteItem\(item: MenuItem\) \{[\s\S]*?const displayImage = preview \?\? form.image_url\n/g, '');

// 5. Remove Tambah Menu Lokal button
content = content.replace(/<button onClick=\{openAdd\}.*?\n.*?Tambah Menu Lokal\n.*?<\/button>/g, '');

// 6. Remove the form modal
content = content.replace(/\{\/\* ── Form Modal ──────────────────────────────────────── \*\/\}\n\s*\{showForm && \([\s\S]*?\)\}\n/g, '');

// 7. Remove the dropdown logic for !isGlobal
content = content.replace(/\{\!isGlobal && \([\s\S]*?<\/>\n\s*\)\}\n/g, '');

// 8. Remove unused imports
content = content.replace(/Plus, Pencil, Trash2, ImagePlus, X, Loader2,\n  AlertCircle, UploadCloud, Sandwich, /g, 'Loader2,\n  Sandwich, ');
// Remove other unused imports if necessary

fs.writeFileSync(path, content, 'utf8');
console.log('Cleaned Kasir Menu Page successfully.');
