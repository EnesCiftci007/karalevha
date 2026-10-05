const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', 'utf8');

const oldReturn = `            return Ok(new {
                message.Id,
                message.Content,
                message.CreatedAt,
                User = new {
                    user!.Id,
                    user.Username
                }
            });`;

const newReturn = `            var returnMessage = new {
                message.Id,
                message.Content,
                message.CreatedAt,
                User = new {
                    user!.Id,
                    user.Username
                }
            };

            await _hubContext.Clients.Group(channelId.ToString()).SendAsync("ReceiveMessage", returnMessage);

            return Ok(returnMessage);`;

c = c.replace(oldReturn, newReturn);
fs.writeFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', c);
