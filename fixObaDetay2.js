const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

// Find the line with setInterval and replace the following block
const fix = c.replace(/      const interval = setInterval\(fetchMessages, 3000\);[\s\S]*?return \(\) => clearInterval\(interval\);/, '      const interval = setInterval(fetchMessages, 3000);\n      return () => clearInterval(interval);');

// Make sure we still have the password UI. If not, add it before the FINAL return.
let final = fix;
if (!final.includes('if (needsPassword) {')) {
  // Extract password UI string here if needed. But it was already there, just removed by the regex.
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
  final = final.replace('  return (\r\n    <div className="flex', passwordUI + '\n  return (\r\n    <div className="flex');
  final = final.replace('  return (\n    <div className="flex', passwordUI + '\n  return (\n    <div className="flex');
}

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', final);
