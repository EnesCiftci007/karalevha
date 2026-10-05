const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Program.cs', 'utf8');

c = c.replace(
  '.AllowAnyMethod();',
  '.AllowAnyMethod()\n              .AllowCredentials();'
);

fs.writeFileSync('Karalevha.API/Program.cs', c);
