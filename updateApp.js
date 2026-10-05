const fs = require('fs');
let content = fs.readFileSync('karalevha-client/src/App.tsx', 'utf8');
content = content.replace("import EOba from './pages/EOba';", "import EOba from './pages/EOba';\nimport ObaDetay from './pages/ObaDetay';");
content = content.replace('<Route path="e-oba" element={<EOba />} />', '<Route path="e-oba" element={<EOba />} />\n              <Route path="e-oba/:id" element={<ObaDetay />} />');
fs.writeFileSync('karalevha-client/src/App.tsx', content);
