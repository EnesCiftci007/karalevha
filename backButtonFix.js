const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

const regex = /<button \r?\n\s*onClick=\{\(\) => setIsSidebarOpen\(true\)\}\r?\n\s*className="md:hidden mr-3 sm:mr-4 text-zinc-400 hover:text-white"\r?\n\s*>\r?\n\s*<Menu className="w-6 h-6" \/>\r?\n\s*<\/button>/;

const replacement = `<Link to="/e-oba" className="md:hidden text-zinc-400 hover:text-white transition-colors mr-2">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="md:hidden mr-3 sm:mr-4 text-zinc-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>`;

c = c.replace(regex, replacement);
fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
