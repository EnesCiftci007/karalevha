const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', 'utf8');

c = c.replace('using Microsoft.EntityFrameworkCore;', 'using Microsoft.EntityFrameworkCore;\nusing Microsoft.AspNetCore.SignalR;\nusing Karalevha.API.Hubs;');

c = c.replace('private readonly AppDbContext _context;', 'private readonly AppDbContext _context;\n        private readonly IHubContext<ChatHub> _hubContext;');

c = c.replace('public ObaMessagesController(AppDbContext context)', 'public ObaMessagesController(AppDbContext context, IHubContext<ChatHub> hubContext)');

c = c.replace('{\n            _context = context;\n        }', '{\n            _context = context;\n            _hubContext = hubContext;\n        }');

const signalRCall = `
            await _context.SaveChangesAsync();

            var returnMessage = new {
                message.Id,
                message.Content,
                message.CreatedAt,
                User = new {
                    user.Id,
                    user.Username
                }
            };

            await _hubContext.Clients.Group(channelId.ToString()).SendAsync("ReceiveMessage", returnMessage);

            return Ok(returnMessage);
`;

c = c.replace(/            await _context.SaveChangesAsync\(\);\r?\n\r?\n            return Ok\(new \{\r?\n                message.Id,[\s\S]*?\}\);\r?\n/, signalRCall);

fs.writeFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', c);
