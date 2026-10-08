import React, { useState, useEffect } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, FileCode2, Loader2, AlertTriangle, FileJson, FileType2, FileImage } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface NativeCodeViewerProps {
  repoUrl: string;
}

interface GitNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  url: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children: Record<string, TreeNode>;
  isOpen: boolean;
}

const getFileIcon = (fileName: string) => {
  if (fileName.endsWith('.json')) return <FileJson className="w-4 h-4 text-yellow-400" />;
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return <FileType2 className="w-4 h-4 text-blue-400" />;
  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return <FileCode2 className="w-4 h-4 text-yellow-300" />;
  if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return <FileCode2 className="w-4 h-4 text-blue-300" />;
  if (fileName.endsWith('.html')) return <FileCode2 className="w-4 h-4 text-orange-400" />;
  if (fileName.match(/\.(png|jpe?g|gif|svg)$/i)) return <FileImage className="w-4 h-4 text-green-400" />;
  return <FileText className="w-4 h-4 text-zinc-400" />;
};

const getLanguage = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'md': return 'markdown';
    case 'py': return 'python';
    case 'cs': return 'csharp';
    default: return 'javascript';
  }
};

export default function NativeCodeViewer({ repoUrl }: NativeCodeViewerProps) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  const owner = match ? match[1] : '';
  const repo = match ? match[2].replace('.git', '') : '';

  useEffect(() => {
    if (!owner || !repo) {
      setError('Geçersiz GitHub URL');
      setLoadingTree(false);
      return;
    }

    const fetchTree = async () => {
      try {
        const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!branchRes.ok) throw new Error('Repo bulunamadı');
        const repoData = await branchRes.json();
        const defaultBranch = repoData.default_branch || 'main';

        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
        if (!res.ok) throw new Error('Ağaç çekilemedi');
        const data = await res.json();
        
        // Build nested tree
        const root: TreeNode = { name: 'root', path: '', type: 'tree', children: {}, isOpen: true };
        
        data.tree.forEach((item: GitNode) => {
          const parts = item.path.split('/');
          let current = root;
          
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current.children[part]) {
              current.children[part] = {
                name: part,
                path: parts.slice(0, i + 1).join('/'),
                type: i === parts.length - 1 ? item.type : 'tree',
                children: {},
                isOpen: false
              };
            }
            current = current.children[part];
          }
        });

        setTree(root);
      } catch (err: any) {
        setError(err.message || 'Repo yüklenirken hata oluştu');
      } finally {
        setLoadingTree(false);
      }
    };

    fetchTree();
  }, [owner, repo]);

  const fetchFile = async (path: string) => {
    setLoadingFile(true);
    setSelectedFile(path);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`);
      if (!res.ok) throw new Error('Dosya okunamadı');
      const text = await res.text();
      setFileContent(text);
    } catch (err) {
      setFileContent('// Dosya yüklenirken hata oluştu veya binary dosya.');
    } finally {
      setLoadingFile(false);
    }
  };

  const toggleFolder = (node: TreeNode) => {
    node.isOpen = !node.isOpen;
    setTree({ ...tree! }); // Force re-render
  };

  const renderTree = (nodes: Record<string, TreeNode>, depth: number = 0) => {
    return Object.values(nodes)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(node => (
        <div key={node.path} className="flex flex-col">
          <div 
            className={`flex items-center py-1 px-2 cursor-pointer hover:bg-[#1f2129] text-sm transition-colors ${selectedFile === node.path ? 'bg-[#00e5ff]/10 text-[#00e5ff]' : 'text-zinc-300'}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => {
              if (node.type === 'tree') toggleFolder(node);
              else fetchFile(node.path);
            }}
          >
            {node.type === 'tree' ? (
              <span className="mr-1 opacity-70">
                {node.isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            ) : (
              <span className="w-4 mr-1"></span>
            )}
            
            {node.type === 'tree' ? (
              <Folder className={`w-4 h-4 mr-2 ${node.isOpen ? 'text-[#00e5ff]' : 'text-zinc-500'}`} />
            ) : (
              <span className="mr-2">{getFileIcon(node.name)}</span>
            )}
            
            <span className="truncate">{node.name}</span>
          </div>
          
          {node.type === 'tree' && node.isOpen && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      ));
  };

  if (loadingTree) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-[#00e5ff] p-8">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <span className="text-sm font-bold uppercase tracking-widest">Repo Ağacı Yükleniyor...</span>
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-red-500 p-8">
        <AlertTriangle className="w-10 h-10 mb-4" />
        <span className="text-sm font-bold uppercase tracking-widest">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#0b0c10] overflow-hidden text-zinc-300">
      {/* Sidebar Tree */}
      <div className="w-64 flex-shrink-0 border-r-2 border-[#1f2129] bg-[#111216] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
        <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 px-2 pt-2 truncate">
          {repo}
        </div>
        {renderTree(tree.children)}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0b0c10]">
        {!selectedFile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
            <FileCode2 className="w-16 h-16 mb-4 opacity-20" />
            <span className="font-bold uppercase tracking-widest text-sm">Görüntülemek için bir dosya seçin</span>
          </div>
        ) : (
          <>
            <div className="flex items-center px-4 py-2 bg-[#111216] border-b-2 border-[#1f2129] text-xs font-bold text-zinc-300">
              <span className="opacity-50 mr-2">{owner} / {repo} / </span>
              <span className="text-[#00e5ff]">{selectedFile}</span>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar relative">
              {loadingFile ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0b0c10]/50 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00e5ff]" />
                </div>
              ) : null}
              <SyntaxHighlighter
                language={getLanguage(selectedFile)}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem',
                  background: 'transparent',
                  fontSize: '0.875rem',
                  lineHeight: '1.5'
                }}
                showLineNumbers={true}
                lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: '#4b5563', textAlign: 'right' }}
              >
                {fileContent}
              </SyntaxHighlighter>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
