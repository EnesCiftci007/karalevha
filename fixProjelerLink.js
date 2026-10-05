const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/Projeler.tsx', 'utf8');

c = c.replace("import { Terminal, FolderGit2, Star, GitFork, ExternalLink, Plus, Code2 } from 'lucide-react';", "import { Terminal, FolderGit2, Star, GitFork, ExternalLink, Plus, Code2 } from 'lucide-react';\nimport { Link } from 'react-router-dom';");

c = c.replace(
  '<div key={project.id} className="bg-[#0b0c10]', 
  '<Link to={`/projeler/${project.id}`} key={project.id} className="bg-[#0b0c10] block'
);

// We want to replace the LAST closing </div> of the map block with </Link>
// The map block is `projects.map((project) => (`
// Instead of complex string parsing, we just find the specific block:
const blockToReplace = `                  <a 
                    href={project.repoUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center text-xs font-black uppercase tracking-widest text-[#00e5ff] hover:text-white transition-colors"
                  >
                    REPO'YA GİT <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>
            ))`;

const replacement = `                  <a 
                    href={project.repoUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center text-xs font-black uppercase tracking-widest text-[#00e5ff] hover:text-white transition-colors"
                  >
                    REPO'YA GİT <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </Link>
            ))`;

c = c.replace(blockToReplace, replacement);

fs.writeFileSync('karalevha-client/src/pages/Projeler.tsx', c);
