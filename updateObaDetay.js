const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

// 1. Add states
c = c.replace("const [loading, setLoading] = useState(true);", "const [loading, setLoading] = useState(true);\n  const [needsPassword, setNeedsPassword] = useState(false);\n  const [password, setPassword] = useState('');\n  const [joinError, setJoinError] = useState('');");

// 2. Add Lock import
c = c.replace("import { Hash, Volume2, Send, Users, ChevronLeft, Zap, MessageSquare } from 'lucide-react';", "import { Hash, Volume2, Send, Users, ChevronLeft, Zap, MessageSquare, Lock } from 'lucide-react';");

// 3. modify fetchChannels
const fetchChannelsStr = `
  const fetchChannels = async () => {
    try {
      const res = await fetch(\`\${API_URL}/api/obachannels/\${id}\`, {
        headers: {
          'Authorization': \`Bearer \${token}\`
        }
      });
      
      if (res.status === 403) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }
      
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        if (data.length > 0) {
          setActiveChannel(data[0]);
        }
      }
    } catch (error) {
      console.error('Kanallar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };
`;
c = c.replace(/  const fetchChannels = async \(\) => \{[\s\S]*?\};\r?\n/, fetchChannelsStr);

// 4. handleJoin
const handleJoin = `
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(\`\${API_URL}/api/obalar/\${id}/join\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setNeedsPassword(false);
        fetchChannels();
      } else {
        const txt = await res.text();
        setJoinError(txt || "Şifre yanlış!");
        setLoading(false);
      }
    } catch(err) {
      setJoinError("Bir hata oluştu.");
      setLoading(false);
    }
  };
`;
c = c.replace('  if (loading) {', handleJoin + '\n  if (loading) {');

// 5. Password UI inside component body
const passwordUI = `
  if (needsPassword) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center bg-[#0b0c10] border-2 border-[#1f2129]">
        <div className="w-full max-w-md bg-[#111216] border-2 border-[#1f2129] p-8 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 text-red-500 border-2 border-red-500/50 flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">GİZLİ OBA</h2>
          <p className="text-zinc-400 font-medium mb-8">Bu obaya girmek için şifre gerekiyor.</p>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifreyi girin..."
              className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#39ff14] text-center font-bold tracking-widest outline-none"
            />
            {joinError && <p className="text-red-500 text-sm font-bold">{joinError}</p>}
            <button 
              type="submit"
              className="w-full py-3 bg-[#39ff14] text-black font-black uppercase tracking-widest hover:bg-white hover:shadow-[4px_4px_0px_#39ff14] hover:-translate-y-1 transition-all border-2 border-black"
            >
              GİRİŞ YAP
            </button>
          </form>
          
          <Link to="/e-oba" className="block mt-6 text-zinc-500 hover:text-white font-bold uppercase text-sm">Geri Dön</Link>
        </div>
      </div>
    );
  }
`;
c = c.replace('  return (', passwordUI + '\n  return (');

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
