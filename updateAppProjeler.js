const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/App.tsx', 'utf8');

c = c.replace("import Projeler from './pages/Projeler';", "import Projeler from './pages/Projeler';\nimport ProjeDetay from './pages/ProjeDetay';");

c = c.replace('<Route path="projeler" element={<Projeler />} />', '<Route path="projeler" element={<Projeler />} />\n              <Route path="projeler/:id" element={<ProjeDetay />} />');

fs.writeFileSync('karalevha-client/src/App.tsx', c);
