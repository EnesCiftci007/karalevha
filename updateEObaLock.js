const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/EOba.tsx', 'utf8');

// import Lock
c = c.replace("import { Plus, Zap, Hash, Users } from 'lucide-react';", "import { Plus, Zap, Hash, Users, Lock } from 'lucide-react';");

// Display Lock icon
const lockUI = `{oba.isPrivate && <Lock className="w-5 h-5 absolute top-3 right-3 text-red-500/80 z-20" />}`;
c = c.replace('<div className="h-24 bg-[#111216]', lockUI + '\n              <div className="h-24 bg-[#111216]');

fs.writeFileSync('karalevha-client/src/pages/EOba.tsx', c);
