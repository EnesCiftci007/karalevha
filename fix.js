const fs = require('fs');
const files = ['BaskiIstasyonu.tsx', 'EOba.tsx', 'Projeler.tsx'];
files.forEach(f => {
  let content = fs.readFileSync('karalevha-client/src/pages/' + f, 'utf8');
  content = content.replace(/http:\/\/localhost:5114/g, '${API_URL}');
  
  if (content.includes("import { api } from '../services/api';")) {
     content = content.replace("import { api } from '../services/api';", "import { api, API_URL } from '../services/api';");
  } else if (!content.includes('API_URL')) {
     content = "import { API_URL } from '../services/api';\n" + content;
  } else if (!content.includes('import { API_URL') && !content.includes('import { api, API_URL')) {
     content = "import { API_URL } from '../services/api';\n" + content;
  }

  fs.writeFileSync('karalevha-client/src/pages/' + f, content);
});
console.log('Fixed files');
