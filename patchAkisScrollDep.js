const fs = require('fs');
const file = 'karalevha-client/src/pages/Akis.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'window.addEventListener(\'scroll\', handleScroll);\n    return () => window.removeEventListener(\'scroll\', handleScroll);\n  }, []);',
  'window.addEventListener(\'scroll\', handleScroll);\n    return () => window.removeEventListener(\'scroll\', handleScroll);\n  }, [loadingMore, hasMore]);'
);

fs.writeFileSync(file, content);
