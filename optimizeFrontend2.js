const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

c = c.replace(
  'if (!newMessage.trim() || !activeChannel || !user) return;',
  `if (!newMessage.trim() || !activeChannel || !user) return;

    // Optimistically clear the input so UX feels instant
    const currentText = newMessage;
    setNewMessage('');`
);

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
