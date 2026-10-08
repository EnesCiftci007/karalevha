const fs = require('fs');
let c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

const regex = /\{\/\* Chat Header \*\/\}\r?\n\s*<div className="h-16 border-b-2 border-\[\#1f2129\] flex items-center px-6 justify-between flex-shrink-0 bg-\[\#111216\]">/;

const replacement = `{/* Chat Header */}
        <div className="h-16 border-b-2 border-[#1f2129] flex items-center px-4 sm:px-6 justify-between flex-shrink-0 bg-[#111216] relative">
          <div className="flex items-center text-white">
            <Link to="/e-oba" className="md:hidden text-zinc-400 hover:text-white transition-colors mr-2">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="md:hidden mr-3 sm:mr-4 text-zinc-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>`;

c = c.replace(regex, replacement);

// We need to remove the original `<div className="flex items-center text-white">` since we included it in replacement to inject inside it.
// Actually wait! 
// Let's just do a clean string replace for the original 2 lines.

c = fs.readFileSync('karalevha-client/src/pages/ObaDetay.tsx', 'utf8');

c = c.replace(
  '<div className="h-16 border-b-2 border-[#1f2129] flex items-center px-6 justify-between flex-shrink-0 bg-[#111216]">\r\n          <div className="flex items-center text-white">',
  `<div className="h-16 border-b-2 border-[#1f2129] flex items-center px-4 sm:px-6 justify-between flex-shrink-0 bg-[#111216] relative">
          <div className="flex items-center text-white">
            <Link to="/e-oba" className="md:hidden text-zinc-400 hover:text-white transition-colors mr-2">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="md:hidden mr-3 sm:mr-4 text-zinc-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>`
);
// In case it's \n instead of \r\n
c = c.replace(
  '<div className="h-16 border-b-2 border-[#1f2129] flex items-center px-6 justify-between flex-shrink-0 bg-[#111216]">\n          <div className="flex items-center text-white">',
  `<div className="h-16 border-b-2 border-[#1f2129] flex items-center px-4 sm:px-6 justify-between flex-shrink-0 bg-[#111216] relative">
          <div className="flex items-center text-white">
            <Link to="/e-oba" className="md:hidden text-zinc-400 hover:text-white transition-colors mr-2">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="md:hidden mr-3 sm:mr-4 text-zinc-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>`
);

fs.writeFileSync('karalevha-client/src/pages/ObaDetay.tsx', c);
