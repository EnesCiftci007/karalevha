const fs = require('fs');

const controllerPath = 'Karalevha.API/Controllers/ObaMessagesController.cs';
let content = fs.readFileSync(controllerPath, 'utf8');

// 1. Replace GetMessages
const getRegex = /\[HttpGet\("\{channelId\}"\)\][\s\S]*?return Ok\(messages\);\s*\}/;
const newGet = `[HttpGet("{channelId}")]
        public async Task<IActionResult> GetMessages(int channelId, [FromQuery] int limit = 50)
        {
            var channel = await _context.ObaChannels.FindAsync(channelId);
            if (channel == null) return NotFound("Kanal bulunamadı");
            
            var oba = await _context.Obalar.FindAsync(channel.ObaId);
            if (oba == null) return NotFound("Oba bulunamadı");

            if (oba.IsPrivate)
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null) return Unauthorized();
                
                var userId = int.Parse(userIdClaim.Value);
                var isMember = await _context.ObaMembers.AnyAsync(m => m.ObaId == oba.Id && m.UserId == userId);
                if (!isMember) return StatusCode(403, "Bu private Oba'ya erişim yetkiniz yok.");
            }

            var messages = await _context.ObaMessages
                .Include(m => m.User)
                .Where(m => m.ChannelId == channelId)
                .OrderByDescending(m => m.CreatedAt)
                .Take(limit)
                .Select(m => new {
                    m.Id,
                    m.Content,
                    m.CreatedAt,
                    User = new {
                        m.User!.Id,
                        m.User.Username
                    }
                })
                .ToListAsync();

            messages.Reverse(); // Return in chronological order
            return Ok(messages);
        }`;

content = content.replace(getRegex, newGet);

// 2. Patch SendMessage to check membership
const sendRegex = /var channel = await _context\.ObaChannels\.FindAsync\(channelId\);\s*if \(channel == null\) return NotFound\("Kanal bulunamadı"\);/;

const membershipCheck = `var channel = await _context.ObaChannels.FindAsync(channelId);
            if (channel == null) return NotFound("Kanal bulunamadı");

            var isMember = await _context.ObaMembers.AnyAsync(m => m.ObaId == channel.ObaId && m.UserId == userId);
            if (!isMember) return StatusCode(403, "Bu kanala mesaj göndermek için Oba'ya katılmalısınız.");
`;

// It might be encoded differently, so let's match with a more flexible regex or string replace
content = content.replace(/var channel = await _context.ObaChannels.FindAsync\(channelId\);[\s\S]*?if \(channel == null\) return NotFound\(".*?"\);/, membershipCheck);


fs.writeFileSync(controllerPath, content);
