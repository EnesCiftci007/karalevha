const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/Projeler.tsx', 'utf8');

c = c.replace(/              <\/div>\r?\n            \)\)/g, '              </Link>\n            ))');

fs.writeFileSync('karalevha-client/src/pages/Projeler.tsx', c);
