import { useEffect, useMemo, useRef } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import arduino from 'react-syntax-highlighter/dist/esm/languages/prism/arduino';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cmake from 'react-syntax-highlighter/dist/esm/languages/prism/cmake';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';
import glsl from 'react-syntax-highlighter/dist/esm/languages/prism/glsl';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import lua from 'react-syntax-highlighter/dist/esm/languages/prism/lua';
import makefile from 'react-syntax-highlighter/dist/esm/languages/prism/makefile';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import matlab from 'react-syntax-highlighter/dist/esm/languages/prism/matlab';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import verilog from 'react-syntax-highlighter/dist/esm/languages/prism/verilog';
import vhdl from 'react-syntax-highlighter/dist/esm/languages/prism/vhdl';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';

const LANGUAGES = {
  arduino, bash, c, cmake, cpp, csharp, css, docker, glsl, go, ini, java, javascript, json, jsx, kotlin, lua,
  makefile, markdown, markup, matlab, php, python, ruby, rust, sql, toml, tsx, typescript, verilog, vhdl, yaml,
};
for (const [name, grammar] of Object.entries(LANGUAGES)) SyntaxHighlighter.registerLanguage(name, grammar);

/*
 * Kod renkleri: sitenin paletinden türetildi. Yalnızca kod içinde kullanılır (DESIGN.md).
 * Anahtar kelimeler fosforlu sprey, yorumlar silik; geri kalanı birbirinden kolay ayrılan pastel tonlar.
 */
const C = {
  text: '#ecebe6',
  muted: '#a8a7a0',
  comment: '#878680',
  keyword: '#d4ff3d',
  string: '#9fe0b0',
  number: '#ffb86b',
  func: '#8ecbff',
  type: '#ff9ecb',
};

const THEME: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': { color: C.text, background: 'none', fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontSize: '13px', lineHeight: '20px', tabSize: 4, whiteSpace: 'pre' },
  'pre[class*="language-"]': { color: C.text, background: 'none', margin: 0, padding: '12px 0', overflow: 'visible' },
  comment: { color: C.comment, fontStyle: 'italic' },
  prolog: { color: C.comment },
  doctype: { color: C.comment },
  cdata: { color: C.comment },
  punctuation: { color: C.muted },
  keyword: { color: C.keyword },
  'control-flow': { color: C.keyword },
  directive: { color: C.keyword },
  'directive-hash': { color: C.keyword },
  macro: { color: C.keyword },
  boolean: { color: C.number },
  number: { color: C.number },
  constant: { color: C.number },
  symbol: { color: C.number },
  string: { color: C.string },
  char: { color: C.string },
  'attr-value': { color: C.string },
  regex: { color: C.string },
  url: { color: C.string },
  function: { color: C.func },
  'function-name': { color: C.func },
  'class-name': { color: C.type },
  builtin: { color: C.type },
  tag: { color: C.type },
  'attr-name': { color: C.func },
  property: { color: C.func },
  selector: { color: C.type },
  operator: { color: C.text },
  variable: { color: C.text },
  important: { color: C.keyword, fontWeight: 600 },
  bold: { fontWeight: 600 },
  italic: { fontStyle: 'italic' },
  title: { color: C.keyword, fontWeight: 600 },
};

interface CodeBlockProps {
  code: string;
  language: string | null;
  /** Vurgulanan satır (1 tabanlı) */
  line?: number | null;
  onLineClick?: (line: number) => void;
  /** Uzun satırlar alta kaysın (yatay kaydırma yerine) */
  wrap?: boolean;
}

// Satır numarası sütununun genişliği; kayan satırların devamı bu kadar içeriden başlar
const GUTTER = '4.75em';

/** Satır numaralı, renklendirilmiş kod. Satır numarasına tıklayınca o satırın bağlantısı oluşur. */
export default function CodeBlock({ code, language, line, onLineClick, wrap = false }: CodeBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Bağlantıyla gelinen satırı ortala. scrollIntoView sayfayı da kaydırırdı; yalnızca kodu taşıyan bölme kayar.
  useEffect(() => {
    if (!line || !ref.current) return;
    const row = ref.current.querySelector<HTMLElement>(`[data-satir="${line}"]`);
    const box = ref.current.closest<HTMLElement>('[data-kod-kaydirma]');
    if (!row) return;
    if (!box) return row.scrollIntoView({ block: 'center' });
    const offset = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: offset - box.clientHeight / 2 });
  }, [line, code]);

  // Kaydırmasızken her satır en uzun satır kadar geniş olsun: vurgu ve seçili satır şeridi sağa kadar uzansın
  const style = useMemo(
    () => ({
      ...THEME,
      'code[class*="language-"]': { ...THEME['code[class*="language-"]'], display: 'block', minWidth: '100%', width: wrap ? 'auto' : 'max-content', whiteSpace: wrap ? 'pre-wrap' : 'pre' },
    }),
    [wrap]
  );

  return (
    <div ref={ref}>
      <SyntaxHighlighter
        language={language ?? 'text'}
        style={style}
        showLineNumbers
        wrapLines
        wrapLongLines={wrap}
        useInlineStyles
        lineNumberStyle={{ minWidth: '3.5em', paddingRight: '1.25em', textAlign: 'right', color: '#5c5b57', userSelect: 'none', textIndent: 0 }}
        lineProps={(n: number) => ({
          'data-satir': n,
          className: `kod-satir${n === line ? ' kod-satir-secili' : ''}`,
          // Kayan satırın devamı numaranın altına değil, kodun hizasına gelsin. Kütüphane kaydırmada satırı
          // flex yapıyor; o zaman kod parçaları alta geçemiyor, bu yüzden normal blok ve asılı girinti kullanılır.
          style: wrap ? { display: 'block', paddingLeft: GUTTER, textIndent: `-${GUTTER}`, overflowWrap: 'anywhere' } : undefined,
          onClick: (e: React.MouseEvent) => {
            // Yalnızca satır numarasına tıklama bağlantı üretir; kod seçimi bozulmasın
            if ((e.target as HTMLElement).classList.contains('linenumber')) onLineClick?.(n);
          },
        } as React.HTMLProps<HTMLElement>)}
      >
        {code.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
}
