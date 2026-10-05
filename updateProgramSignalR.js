const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Program.cs', 'utf8');

c = c.replace('builder.Services.AddControllers();', 'builder.Services.AddControllers();\nbuilder.Services.AddSignalR();');

c = c.replace('app.MapControllers();', 'app.MapControllers();\napp.MapHub<Karalevha.API.Hubs.ChatHub>("/chathub");');

fs.writeFileSync('Karalevha.API/Program.cs', c);
