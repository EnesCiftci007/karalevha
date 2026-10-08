const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

c = c.replace(
  `        const msg = await res.json();
        // Gercegiyle degistir
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m));`,
  `        const msg = await res.json();
        // Gercegiyle degistir (Eger SignalR bizden hizli davranip mesaji eklediyse, sadece gecici olani sil)
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? msg : m);
        });`
);

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
