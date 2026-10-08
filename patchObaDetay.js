const fs = require('fs');
const file = 'karalevha-client/src/pages/ObaDetay.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  ".withUrl(`${import.meta.env.VITE_API_URL || API_URL}/chathub`)",
  ".withUrl(`${import.meta.env.VITE_API_URL || API_URL}/chathub`, { accessTokenFactory: () => token })"
);

fs.writeFileSync(file, content);
