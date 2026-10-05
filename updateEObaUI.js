const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/EOba.tsx', 'utf8');

// Add isPrivate state
c = c.replace("const [color, setColor] = useState('#39ff14');", "const [color, setColor] = useState('#39ff14');\n  const [isPrivate, setIsPrivate] = useState(false);");

// Update handleCreateOba body
c = c.replace("body: JSON.stringify({ name, description, color })", "body: JSON.stringify({ name, description, color, isPrivate })");

// Add reset
c = c.replace("setColor('#39ff14');", "setColor('#39ff14');\n        setIsPrivate(false);");

// Add Checkbox UI in the Modal
const checkboxUI = `
                <div className="mb-6 flex items-center">
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
                
                <div className="flex gap-4">`;
c = c.replace('<div className="flex gap-4">', checkboxUI);

fs.writeFileSync('karalevha-client/src/pages/EOba.tsx', c);
