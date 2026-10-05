const fs = require('fs');
let content = fs.readFileSync('karalevha-client/src/pages/EOba.tsx', 'utf8');
content = content.replace("import { Plus, Zap, Hash, Users } from 'lucide-react';", "import { Plus, Zap, Hash, Users } from 'lucide-react';\nimport { Link } from 'react-router-dom';");

// find <div key={oba.id} className="bg-[#0b0c10] border-2 border-[#1f2129]
// replace with <Link to={`/e-oba/${oba.id}`} key={oba.id} className="bg-[#0b0c10] border-2 border-[#1f2129] block group hover:border-[#39ff14]/50 transition-colors relative overflow-hidden">
content = content.replace(
  /<div key={oba\.id} className="bg-\[#0b0c10\] border-2 border-\[#1f2129\] flex flex-col group hover:border-\[#39ff14\]\/50 transition-colors relative overflow-hidden">/g,
  '<Link to={`/e-oba/${oba.id}`} key={oba.id} className="bg-[#0b0c10] border-2 border-[#1f2129] flex flex-col group hover:border-[#39ff14]/50 transition-colors relative overflow-hidden">'
);

// We must also replace the closing </div> of that map with </Link>
// The easiest way is regex or manual since we know the structure
content = content.replace(
  /                  <\/span>\r?\n                <\/div>\r?\n              <\/div>\r?\n            <\/div>/g,
  '                  </span>\n                </div>\n              </div>\n            </Link>'
);

fs.writeFileSync('karalevha-client/src/pages/EOba.tsx', content);
