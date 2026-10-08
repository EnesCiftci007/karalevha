const fs = require('fs');

function addInfiniteScroll(filePath, arrayName) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('visibleCount')) return; // Already added

  // Add state
  content = content.replace(
    'const [initialLoad, setInitialLoad] = useState(true);',
    `const [initialLoad, setInitialLoad] = useState(true);\n  const [visibleCount, setVisibleCount] = useState(10);`
  );
  
  // Add Scroll Listener
  const scrollHook = `
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200) {
        setVisibleCount(prev => prev + 5);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
`;
  
  content = content.replace('useEffect(() => {', scrollHook + '\n  useEffect(() => {');
  
  // Replace array mapping with slice
  // Find {arrayName.map(
  const mapRegex = new RegExp(`\\{${arrayName}\\.map\\(`, 'g');
  content = content.replace(mapRegex, `{${arrayName}.slice(0, visibleCount).map(`);

  // Add a loading indicator at the bottom if there are more
  const mapEndStr = `))
        )}`;
  
  const mapEndRegex = new RegExp(`\\)\\)\\s*\\)\\s*\\}`, 'g');
  const replacement = `))
        )}
        
        {${arrayName}.length > visibleCount && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        )}`;

  // It's safer to just replace it manually using simple string splits
  content = content.replace(
    `))
        )}`,
    replacement
  );
  
  // Alternative replace for EOba which might have different formatting
  content = content.replace(
    `))
          )}`,
    `))
          )}
          {${arrayName}.length > visibleCount && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          )}`
  );

  fs.writeFileSync(filePath, content);
}

addInfiniteScroll('karalevha-client/src/pages/Akis.tsx', 'posts');
addInfiniteScroll('karalevha-client/src/pages/Projeler.tsx', 'filteredProjects');
addInfiniteScroll('karalevha-client/src/pages/EOba.tsx', 'filteredObalar');
