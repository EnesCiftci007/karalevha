const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', 'utf8');

const slowmodeCode = `
            // Slowmode Check (3 seconds)
            var lastMessage = await _context.ObaMessages
                .Where(m => m.UserId == userId && m.ChannelId == channelId)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();
                
            if (lastMessage != null && (DateTime.UtcNow - lastMessage.CreatedAt).TotalSeconds < 3)
            {
                return BadRequest(new { message = "Yavaş Mod Aktif: Lütfen ard arda mesaj göndermeden önce bekleyin." });
            }

            var message = new ObaMessage`;

c = c.replace('var message = new ObaMessage', slowmodeCode);
fs.writeFileSync('Karalevha.API/Controllers/ObaMessagesController.cs', c);
