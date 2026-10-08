const fs = require('fs');

// 1. Update App.tsx
let appTsx = fs.readFileSync('karalevha-client/src/App.tsx', 'utf8');
appTsx = appTsx.replace(
  "import ProjeDetay from './pages/ProjeDetay';",
  "import ProjeDetay from './pages/ProjeDetay';\nimport Profil from './pages/Profil';"
);
appTsx = appTsx.replace(
  '<Route path="projeler/:id" element={<ProjeDetay />} />',
  '<Route path="projeler/:id" element={<ProjeDetay />} />\n              <Route path="profil/:username" element={<Profil />} />'
);
fs.writeFileSync('karalevha-client/src/App.tsx', appTsx);

// 2. Update Navbar.tsx
let navTsx = fs.readFileSync('karalevha-client/src/components/Navbar.tsx', 'utf8');
navTsx = navTsx.replace(
  '<span className="hidden md:inline font-bold uppercase tracking-widest text-sm">{user.username}</span>',
  '<Link to={`/profil/${user.username}`} className="hidden md:inline font-bold uppercase tracking-widest text-sm hover:text-white transition-colors">{user.username}</Link>'
);
navTsx = navTsx.replace(
  '<span className="font-bold uppercase tracking-widest text-sm text-zinc-300">{user.username}</span>',
  '<Link to={`/profil/${user.username}`} onClick={() => setIsMobileMenuOpen(false)} className="font-bold uppercase tracking-widest text-sm text-zinc-300 hover:text-white transition-colors">{user.username}</Link>'
);
fs.writeFileSync('karalevha-client/src/components/Navbar.tsx', navTsx);
