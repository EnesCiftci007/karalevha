const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

c = c.replace(
  "import { useParams, Link } from 'react-router-dom';", 
  "import { useParams, Link } from 'react-router-dom';\nimport * as signalR from '@microsoft/signalr';"
);

c = c.replace(
  "const [joinError, setJoinError] = useState('');",
  "const [joinError, setJoinError] = useState('');\n  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);"
);

// We need to inject the SignalR connection effect
const signalREffect = `
  // Setup SignalR connection
  useEffect(() => {
    if (!token) return;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(\`\${import.meta.env.VITE_API_URL || API_URL}/chathub\`)
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
  }, [token]);

  // Connect and subscribe to messages
  useEffect(() => {
    if (connection) {
      connection.start()
        .then(() => {
          console.log('Connected to SignalR');
          
          connection.on('ReceiveMessage', (message: Message) => {
            // Prevent duplicate messages if we are the sender and already optimistically updated
            setMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              return [...prev, message];
            });
          });
        })
        .catch(e => console.log('Connection failed: ', e));
    }
  }, [connection]);

  // Join channel group when activeChannel changes
  useEffect(() => {
    if (connection && connection.state === signalR.HubConnectionState.Connected && activeChannel) {
      connection.invoke('JoinChannel', activeChannel.id.toString())
        .catch(err => console.error(err));
        
      return () => {
        connection.invoke('LeaveChannel', activeChannel.id.toString())
          .catch(err => console.error(err));
      };
    }
  }, [connection, activeChannel]);
`;

c = c.replace('  const messagesEndRef = useRef<HTMLDivElement>(null);', '  const messagesEndRef = useRef<HTMLDivElement>(null);\n' + signalREffect);

// Remove the setInterval polling
c = c.replace('      const interval = setInterval(fetchMessages, 3000);', '');
c = c.replace('      return () => clearInterval(interval);', '');

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
