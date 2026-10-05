const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

const oldEffect = `  // Connect and subscribe to messages
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
  }, [connection, activeChannel]);`;

const newEffect = `  const [isConnected, setIsConnected] = useState(false);

  // Connect and subscribe to messages
  useEffect(() => {
    if (connection) {
      connection.start()
        .then(() => {
          console.log('Connected to SignalR');
          setIsConnected(true);
          
          connection.on('ReceiveMessage', (message: Message) => {
            setMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              return [...prev, message];
            });
          });
        })
        .catch(e => console.log('Connection failed: ', e));
    }
  }, [connection]);

  // Join channel group when activeChannel changes OR when connection establishes
  useEffect(() => {
    if (isConnected && connection && activeChannel) {
      connection.invoke('JoinChannel', activeChannel.id.toString())
        .then(() => console.log("Joined channel: ", activeChannel.id))
        .catch(err => console.error("JoinChannel error: ", err));
        
      return () => {
        connection.invoke('LeaveChannel', activeChannel.id.toString())
          .catch(err => console.error(err));
      };
    }
  }, [isConnected, connection, activeChannel]);`;

c = c.replace(oldEffect, newEffect);

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
