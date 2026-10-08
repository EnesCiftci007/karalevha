const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

const regex = /      try {\r?\n        const res = await fetch\(`\$\{API_URL\}\/api\/obamessages\/\$\{activeChannel\.id\}`/;

const replacement = `      // Optimistically clear the input so UX feels instant
      const currentText = newMessage;
      setNewMessage('');

      try {
        const res = await fetch(\`\${API_URL}/api/obamessages/\${activeChannel.id}\``;

c = c.replace(regex, replacement);

c = c.replace(/body: JSON\.stringify\(\{ content: newMessage \}\)/, 'body: JSON.stringify({ content: currentText })');

c = c.replace(/          setNewMessage\(''\);\r?\n/, '');

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
