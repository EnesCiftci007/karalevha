const fs = require('fs');

let projeler = fs.readFileSync('karalevha-client/src/pages/Projeler.tsx', 'utf8');

if (!projeler.includes('useLocation')) {
  projeler = projeler.replace(
    "import { Plus, Search, Star, GitFork, ExternalLink, Code2, Loader2 } from 'lucide-react';",
    "import { Plus, Search, Star, GitFork, ExternalLink, Code2, Loader2 } from 'lucide-react';\nimport { useLocation } from 'react-router-dom';"
  );
}

projeler = projeler.replace(
  'const [showModal, setShowModal] = useState(false);',
  `const location = useLocation();\n  const [showModal, setShowModal] = useState(new URLSearchParams(location.search).get('new') === 'true');`
);

fs.writeFileSync('karalevha-client/src/pages/Projeler.tsx', projeler);
