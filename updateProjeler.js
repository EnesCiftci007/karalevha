const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/Projeler.tsx', 'utf8');

c = c.replace("import { Terminal, FolderGit2, Star, GitFork, ExternalLink, Plus, Code2 } from 'lucide-react';", "import { Terminal, FolderGit2, Star, GitFork, ExternalLink, Plus, Code2 } from 'lucide-react';\nimport { Link } from 'react-router-dom';");

// find map return
c = c.replace(
  '<div key={project.id} className="bg-[#0b0c10]', 
  '<Link to={`/projeler/${project.id}`} key={project.id} className="bg-[#0b0c10] block'
);

// close Link
c = c.replace(
  '              </a>\r\n            </div>\r\n          </div>',
  '              </a>\r\n            </div>\r\n          </Link>'
);
c = c.replace(
  '              </a>\n            </div>\n          </div>',
  '              </a>\n            </div>\n          </Link>'
);

fs.writeFileSync('karalevha-client/src/pages/Projeler.tsx', c);
