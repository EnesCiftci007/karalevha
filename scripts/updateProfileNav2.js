const fs = require('fs');

let navTsx = fs.readFileSync('karalevha-client/src/components/layout/Navbar.tsx', 'utf8');
navTsx = navTsx.replace(
  '<span className="hidden md:inline font-bold uppercase tracking-widest text-sm">{user.username}</span>',
  '<Link to={`/profil/${user.username}`} className="hidden md:inline font-bold uppercase tracking-widest text-sm hover:text-white transition-colors">{user.username}</Link>'
);
navTsx = navTsx.replace(
  '<span className="font-bold uppercase tracking-widest text-sm text-zinc-300">{user.username}</span>',
  '<Link to={`/profil/${user.username}`} onClick={() => setIsMobileMenuOpen(false)} className="font-bold uppercase tracking-widest text-sm text-zinc-300 hover:text-white transition-colors">{user.username}</Link>'
);
fs.writeFileSync('karalevha-client/src/components/layout/Navbar.tsx', navTsx);
