const fs = require('fs');
const files = ['BaskiIstasyonu.tsx', 'EOba.tsx', 'Projeler.tsx'];
files.forEach(f => {
  let content = fs.readFileSync('karalevha-client/src/pages/' + f, 'utf8');
  content = content.replace(/'\$\{API_URL\}(.*?)'/g, '`${API_URL}$1`');
  fs.writeFileSync('karalevha-client/src/pages/' + f, content);
});
console.log('Fixed quotes');
