const fs = require('fs');
const file = 'karalevha-client/src/pages/Akis.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace state
content = content.replace(
  'const [visibleCount, setVisibleCount] = useState(10);',
  'const [page, setPage] = useState(1);\n  const [hasMore, setHasMore] = useState(true);\n  const [loadingMore, setLoadingMore] = useState(false);'
);

// Replace fetchPosts
content = content.replace(
  /const fetchPosts = async \(\) => \{[\s\S]*?finally \{[\s\S]*?setInitialLoad\(false\);[\s\S]*?\}[\s\S]*?\};/,
  `const fetchPosts = async (pageNum: number) => {
    try {
      if (pageNum > 1) setLoadingMore(true);
      const data = await api<any>(\`/api/posts?page=\${pageNum}&pageSize=10\`);
      if (data.length < 10) setHasMore(false);
      
      if (pageNum === 1) {
        setPosts(data);
      } else {
        setPosts(prev => {
          // Avoid duplicates in React Strict Mode
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = data.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
    } catch (error) {
      console.error('Gönderiler yüklenemedi:', error);
    } finally {
      setInitialLoad(false);
      setLoadingMore(false);
    }
  };`
);

// Replace handleScroll
content = content.replace(
  /const handleScroll = \(\) => \{[\s\S]*?setVisibleCount\(prev => prev \+ 5\);[\s\S]*?\};/,
  `const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200) {
        if (!loadingMore && hasMore) {
          setPage(prev => prev + 1);
        }
      }
    };`
);

// Replace useEffect for fetchPosts
content = content.replace(
  /useEffect\(\(\) => \{\s*fetchPosts\(\);\s*\}, \[\]\);/,
  `useEffect(() => {
    fetchPosts(page);
  }, [page]);`
);

// Replace filteredPosts.slice(0, visibleCount) with just filteredPosts
content = content.replace(
  /filteredPosts\.slice\(0, visibleCount\)\.map/g,
  'filteredPosts.map'
);

// Replace length check for Loader
content = content.replace(
  /filteredPosts\.length > visibleCount/,
  'hasMore && posts.length > 0'
);

// We need to replace any escaped backticks if they are present.
// Since we are writing via script, template literals might get messed up if we don't escape properly in the replacement string above, but I used \` for string interpolation! It should be fine.

fs.writeFileSync(file, content);
