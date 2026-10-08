const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

c = c.replace(
  "import { Hash, Volume2, Send, Users, ChevronLeft, Zap, MessageSquare, Lock } from 'lucide-react';",
  "import { Hash, Volume2, Send, Users, ChevronLeft, Zap, MessageSquare, Lock, Menu, X } from 'lucide-react';"
);

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
