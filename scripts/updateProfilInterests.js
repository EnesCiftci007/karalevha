const fs = require('fs');

let content = fs.readFileSync('karalevha-client/src/pages/Profil.tsx', 'utf8');

// 1. Add Interests to ProfileData interface
content = content.replace(
  'bio: string | null;',
  'bio: string | null;\n  interests?: string[];'
);

// 2. Add Edit state
content = content.replace(
  "const [editBio, setEditBio] = useState('');",
  "const [editBio, setEditBio] = useState('');\n  const [editInterests, setEditInterests] = useState<string[]>([]);\n  const AVAILABLE_INTERESTS = ['Yazılım', 'Robotik', '3B Baskı', 'Elektronik', 'El İşi', 'Tasarım', 'Oyun Geliştirme', 'IoT'];"
);

// 3. Initialize state
content = content.replace(
  "setEditBio(data.bio || '');",
  "setEditBio(data.bio || '');\n      setEditInterests(data.interests || []);"
);

// 4. Save state
content = content.replace(
  "body: JSON.stringify({ bio: editBio })",
  "body: JSON.stringify({ bio: editBio, interests: editInterests })"
);

content = content.replace(
  "setProfile(prev => prev ? { ...prev, bio: data.bio } : null);",
  "setProfile(prev => prev ? { ...prev, bio: data.bio, interests: data.interests } : null);"
);

// 5. Toggle Interest function
content = content.replace(
  "const saveProfile = async () => {",
  `const toggleInterest = (interest: string) => {
    setEditInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]);
  };

  const saveProfile = async () => {`
);

// 6. UI
const newUI = `              {isEditing ? (
              <div className="space-y-4">
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Kendinden bahset..."
                  className="w-full bg-[#0b0c10] border-2 border-zinc-800 p-3 text-zinc-300 focus:border-[#00e5ff] focus:outline-none min-h-[100px] resize-none"
                  maxLength={255}
                />
                
                <div>
                  <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">İlgi Alanları</h4>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_INTERESTS.map(interest => (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={\`px-2 py-1 text-xs font-bold uppercase tracking-widest border-2 transition-colors \${editInterests.includes(interest) ? 'border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff]/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}\`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full bg-[#00e5ff] text-black font-black uppercase tracking-widest py-2 hover:bg-white transition-colors flex justify-center items-center"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-zinc-300 text-sm leading-relaxed">
                  {profile.bio || <span className="text-zinc-600 italic">Biyografi eklenmemiş.</span>}
                </p>
                {profile.interests && profile.interests.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">İlgi Alanları</h4>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest, i) => (
                        <span key={i} className="px-2 py-1 text-[10px] font-black text-[#00e5ff] uppercase tracking-widest border-2 border-[#00e5ff]/30 bg-[#00e5ff]/5">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}`;

content = content.replace(
  /\{isEditing \? \([\s\S]*?\} \: \([\s\S]*?\)\}/,
  newUI
);

fs.writeFileSync('karalevha-client/src/pages/Profil.tsx', content);
