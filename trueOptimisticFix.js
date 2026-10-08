const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

const oldHandle = `  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;

    // Optimistically clear the input so UX feels instant
    const currentText = newMessage;
    setNewMessage('');

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
        setMessages(prev => [...prev, msg]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Mesaj gonderilemedi:', error);
    }
  };`;

const newHandle = `  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;

    const currentText = newMessage;
    setNewMessage('');

    // Ekrana aninda yansit
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
        // Gercegiyle degistir
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (error) {
      console.error('Hata:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };`;

c = c.replace(oldHandle, newHandle);
fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
