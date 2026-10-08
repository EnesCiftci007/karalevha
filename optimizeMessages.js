const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', 'utf8');

const regex = /            var message = new ObaMessage[\s\S]*?return Ok\(returnMessage\);/;

const replacement = `            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

            var message = new ObaMessage
            {
                Content = dto.Content,
                ChannelId = channelId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObaMessages.Add(message);
            await _context.SaveChangesAsync();

            var returnMessage = new {
                message.Id,
                message.Content,
                message.CreatedAt,
                User = new {
                    Id = userId,
                    Username = username
                }
            };

            // Fire and forget SignalR broadcast
            _ = _hubContext.Clients.Group(channelId.ToString()).SendAsync("ReceiveMessage", returnMessage);

            return Ok(returnMessage);`;

c = c.replace(regex, replacement);

fs.writeFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', c);
