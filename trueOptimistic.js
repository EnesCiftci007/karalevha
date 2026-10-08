const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

const oldHandleSend = c.substring(c.indexOf('  const handleSendMessage = async (e: React.FormEvent) => {'), c.indexOf('  const formatTime = (dateString: string) => {'));

const newHandleSend = `  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;

    const currentText = newMessage;
    setNewMessage('');

    // Optimistic UI: Ekrana aninda yansit
    const tempId = -Math.floor(Math.random() * 1000000);
    const optimisticMessage: Message = {
      id: tempId,
      content: currentText,
      createdAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username
      }
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const res = await fetch(\`\${API_URL}/api/obamessages/\${activeChannel.id}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ content: currentText })
      });

      if (res.ok) {
        const msg = await res.json();
        // Gecici mesaji gercegiyle degistir (veya eger SignalR'dan coktan geldiyse bunu atla)
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m));
      } else {
        // Hata durumunda gecici mesaji sil
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (error) {
      console.error('Mesaj gonderilemedi:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

`;

c = c.replace(oldHandleSend, newHandleSend);
fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
