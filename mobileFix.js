const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

if (!c.includes('isSidebarOpen')) {
  // 1. Add state and Menu icon import
  c = c.replace(
    "import { Users, Lock, ChevronLeft, Plus, Hash, Settings, Trash2, Send, Zap } from 'lucide-react';",
    "import { Users, Lock, ChevronLeft, Plus, Hash, Settings, Trash2, Send, Zap, Menu, X } from 'lucide-react';"
  );
  
  c = c.replace(
    "const [connection, setConnection] = useState<signalR.HubConnection | null>(null);",
    "const [connection, setConnection] = useState<signalR.HubConnection | null>(null);\n  const [isSidebarOpen, setIsSidebarOpen] = useState(false);"
  );

  // 2. Modify Sidebar classes and add overlay
  c = c.replace(
    '<div className="w-64 bg-[#111216] border-r-2 border-[#1f2129] flex flex-col flex-shrink-0">',
    `{/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/80 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* SIDEBAR (Channels) */}
      <div className={\`absolute inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#111216] border-r-2 border-[#1f2129] flex flex-col flex-shrink-0 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}\`}>
        {/* Mobile close button inside sidebar header */}
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden absolute top-4 right-4 text-zinc-400 hover:text-white z-50">
           <X className="w-6 h-6" />
        </button>`
  );

  // 3. Add Hamburger Menu to Chat Area Header
  c = c.replace(
    '<div className="h-16 border-b-2 border-[#1f2129] flex items-center px-6 bg-[#0b0c10] flex-shrink-0 relative">',
    `<div className="h-16 border-b-2 border-[#1f2129] flex items-center px-4 sm:px-6 bg-[#0b0c10] flex-shrink-0 relative">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="md:hidden mr-3 sm:mr-4 text-zinc-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>`
  );

  // 4. Close sidebar when a channel is clicked
  c = c.replace(
    /onClick=\{\(\) => setActiveChannel\(channel\)\}/g,
    "onClick={() => { setActiveChannel(channel); setIsSidebarOpen(false); }}"
  );

  fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
  console.log("Mobile responsiveness injected!");
} else {
  console.log("Already has isSidebarOpen.");
}
