const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ProjeDetay.tsx', 'utf8');

// Import NativeCodeViewer
c = c.replace(
  "import { Project } from '../types';",
  "import { Project } from '../types';\nimport NativeCodeViewer from '../components/NativeCodeViewer';"
);

// Remove iframe logic and replace with NativeCodeViewer
c = c.replace(
  /        \{isGithub \? \([\s\S]*?\) : \([\s\S]*?\)\}/,
  `        {isGithub ? (
          <NativeCodeViewer repoUrl={project.repoUrl} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8 text-center">
            <AlertTriangle className="w-12 h-12 mb-4" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-white mb-2">Desteklenmeyen Repo Formatı</h3>
            <p className="mb-4">İnteraktif kod inceleyici şu an sadece GitHub linklerini destekliyor.</p>
            <a 
              href={project.repoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#00e5ff] text-black font-black uppercase tracking-widest hover:bg-white transition-colors"
            >
              Doğrudan Repoya Git
            </a>
          </div>
        )}`
);

fs.writeFileSync('karalevha-client/src/pages/ProjeDetay.tsx', c);
