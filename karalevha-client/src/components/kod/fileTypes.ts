import { formatOf } from '../../utils/loadModel';

/** Dosya adından Prism dil adı (renklendirme için). Bilinmeyenler düz metin. */
const BY_EXTENSION: Record<string, string> = {
  ino: 'arduino', pde: 'arduino',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  py: 'python', pyw: 'python',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', mts: 'typescript',
  jsx: 'jsx', tsx: 'tsx',
  cs: 'csharp', java: 'java', kt: 'kotlin', kts: 'kotlin',
  json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml',
  ini: 'ini', cfg: 'ini', properties: 'ini', conf: 'ini',
  md: 'markdown', markdown: 'markdown',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  css: 'css', html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup', vue: 'markup',
  go: 'go', rs: 'rust', sql: 'sql', php: 'php', rb: 'ruby', lua: 'lua',
  glsl: 'glsl', frag: 'glsl', vert: 'glsl',
  m: 'matlab', v: 'verilog', sv: 'verilog', vhd: 'vhdl', vhdl: 'vhdl',
  mk: 'makefile', cmake: 'cmake',
};

const BY_NAME: Record<string, string> = {
  makefile: 'makefile', 'cmakelists.txt': 'cmake', dockerfile: 'docker',
};

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function extension(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function languageOf(path: string): string | null {
  return BY_NAME[baseName(path).toLowerCase()] ?? BY_EXTENSION[extension(path)] ?? null;
}

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico']);

/** Görüntüleyicinin dosyayı nasıl göstereceği */
export type ViewKind = 'markdown' | 'image' | 'model' | 'code';

export function viewKindOf(path: string): ViewKind {
  const ext = extension(path);
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (IMAGE.has(ext)) return 'image';
  if (formatOf(path)) return 'model'; // STL, 3MF, OBJ, FBX, GLB
  return 'code';
}

/** Ağaçta README'yi bul: kökteki README.md önce */
export function findReadme(paths: string[], dir = ''): string | null {
  const prefix = dir ? `${dir}/` : '';
  const candidates = paths.filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/') && /^readme(\.(md|markdown|txt))?$/i.test(baseName(p)));
  return candidates.sort((a, b) => (/\.md$/i.test(b) ? 1 : 0) - (/\.md$/i.test(a) ? 1 : 0))[0] ?? null;
}
