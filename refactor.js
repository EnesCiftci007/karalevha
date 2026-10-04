const fs = require('fs');

function refactorFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  if (!content.includes('import { api }')) {
    content = content.replace(/(import .*?;[\r\n]+)/, "$1import { api } from '../services/api';\n");
  }

  // Refactor GET calls
  content = content.replace(/const res = await fetch\(['"`]http:\/\/localhost:5114(\/api\/.*?)['"`]\);\s*if \(!res\.ok\) throw new Error\(.*?\);\s*const data = await res\.json\(\);/g, "const data = await api<any>('$1');");
  
  content = content.replace(/const res = await fetch\(['"`]http:\/\/localhost:5114(\/api\/.*?)['"`]\);\s*const data = await res\.json\(\);/g, "const data = await api<any>('$1');");

  // Refactor POST calls
  content = content.replace(/const res = await fetch\(['"`]http:\/\/localhost:5114(\/api\/.*?)['"`], \{\s*method:\s*['"`]POST['"`],\s*headers:[\s\S]*?body:\s*JSON\.stringify\((.*?)\)\s*\}\);\s*if \(!res\.ok\) throw new Error\(.*?\);\s*const new(.*?)\s*=\s*await res\.json\(\);/g, 
  "const new$3 = await api<any>('$1', { method: 'POST', body: JSON.stringify($2) });");

  // Refactor BaskiIstasyonu POST call
  content = content.replace(/const res = await fetch\('http:\/\/localhost:5114(\/api\/printmodels)', \{\s*method: 'POST',\s*headers: \{\s*'Authorization':[\s\S]*?body: formData\s*\}\);\s*if \(!res\.ok\) throw new Error\(.*?\);\s*await fetchModels\(\);/g, 
  "await api<any>('$1', { method: 'POST', body: formData });\n      await fetchModels();");

  fs.writeFileSync(path, content);
}

try {
  refactorFile('karalevha-client/src/pages/Akis.tsx');
  refactorFile('karalevha-client/src/pages/BaskiIstasyonu.tsx');
  refactorFile('karalevha-client/src/pages/EOba.tsx');
  refactorFile('karalevha-client/src/pages/Projeler.tsx');
} catch (e) {
  console.error(e);
}
