const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ObaChannelsController.cs', 'utf8');

const securityCheck = `
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);
            
            var oba = await _context.Obalar.FindAsync(obaId);
            if (oba == null) return NotFound("Oba bulunamadı");
            
            var isMember = await _context.ObaMembers.AnyAsync(m => m.ObaId == obaId && m.UserId == userId);
            
            if (!isMember) {
                if (oba.IsPrivate) {
                    return StatusCode(403, "Bu gizli bir oba, katılmak için şifre girmelisiniz.");
                } else {
                    // Auto join if public
                    _context.ObaMembers.Add(new ObaMember { ObaId = obaId, UserId = userId, Role = "member" });
                    oba.MemberCount += 1;
                    await _context.SaveChangesAsync();
                }
            }

            var channels`;

c = c.replace('var channels', securityCheck);
fs.writeFileSync('Karalevha.API/Controllers/ObaChannelsController.cs', c);
