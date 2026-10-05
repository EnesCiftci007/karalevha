const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/EOba.tsx', 'utf8');

// 1. Add joinPassword state
c = c.replace("const [isPrivate, setIsPrivate] = useState(false);", "const [isPrivate, setIsPrivate] = useState(false);\n  const [joinPassword, setJoinPassword] = useState('');");

// 2. Add joinPassword to body
c = c.replace("body: JSON.stringify({ name, description, color, isPrivate })", "body: JSON.stringify({ name, description, color, isPrivate, joinPassword })");

// 3. Reset password
c = c.replace("setIsPrivate(false);", "setIsPrivate(false);\n        setJoinPassword('');");

// 4. Add password UI if isPrivate is true
const pwdUI = `
              <div className="flex items-center mt-6 mb-6">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-5 h-5 bg-[#0b0c10] border-2 border-[#1f2129] text-[#39ff14] focus:ring-[#39ff14] focus:ring-offset-[#111216] rounded-sm accent-[#39ff14]"
                  />
                  <label htmlFor="isPrivate" className="ml-3 block text-sm font-bold text-zinc-300 uppercase tracking-widest cursor-pointer">
                    Gizli Oba (Sadece Üyeler)
                  </label>
              </div>

              {isPrivate && (
                <div className="space-y-2 mb-6 animate-in slide-in-from-top-2">
                  <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Katılım Şifresi</label>
                  <input 
                    type="text" 
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Oba şifresi belirle..."
                    className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#39ff14] outline-none transition-colors"
                  />
                </div>
              )}
`;
c = c.replace(/<div className="flex items-center mt-6 mb-6">[\s\S]*?<\/div>/, pwdUI);

// 5. Add Delete Button
c = c.replace("import { Plus, Zap, Hash, Users, Lock } from 'lucide-react';", "import { Plus, Zap, Hash, Users, Lock, Trash2 } from 'lucide-react';");

const deleteFunc = `
  const handleDeleteOba = async (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // Prevent Link navigation
    if (!window.confirm("Bu obayı tamamen silmek istediğine emin misin? Tüm kanallar ve mesajlar kalıcı olarak yok olacak!")) return;
    
    try {
      const res = await fetch(\`\${API_URL}/api/obalar/\${id}\`, {
        method: 'DELETE',
        headers: {
          'Authorization': \`Bearer \${token}\`
        }
      });
      if (res.ok) {
        setObalar(obalar.filter(o => o.id !== id));
      }
    } catch(err) {
      console.error(err);
    }
  };
`;
c = c.replace("const handleCreateOba =", deleteFunc + "\n  const handleCreateOba =");

const deleteBtnUI = `
              {user?.username === oba.owner && (
                <button 
                  onClick={(e) => handleDeleteOba(e, oba.id)}
                  className="absolute top-3 left-3 z-20 text-zinc-500 hover:text-red-500 transition-colors p-2 bg-[#111216] border-2 border-[#1f2129] hover:border-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
`;
c = c.replace('{oba.isPrivate &&', deleteBtnUI + '\n              {oba.isPrivate &&');

fs.writeFileSync('karalevha-client/src/pages/EOba.tsx', c);
