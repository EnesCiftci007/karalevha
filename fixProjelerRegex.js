const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/Projeler.tsx', 'utf8');

c = c.replace(
  /<ExternalLink className="w-3 h-3 ml-1" \/>\s*<\/a>\s*<\/div>\s*<\/div>\s*\)\)/,
  '<ExternalLink className="w-3 h-3 ml-1" />\n                  </a>\n                </div>\n              </Link>\n            ))'
);

fs.writeFileSync('karalevha-client/src/pages/Projeler.tsx', c);
