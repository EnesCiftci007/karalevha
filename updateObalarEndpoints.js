const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ObalarController.cs', 'utf8');

c = c.replace('IsPrivate = dto.IsPrivate,', 'IsPrivate = dto.IsPrivate,\n                JoinPassword = dto.JoinPassword,');

const newEndpoints = `
        public class JoinObaDto {
            public string? Password { get; set; }
        }

        // POST: api/obalar/{id}/join
        [HttpPost("{id}/join")]
        [Authorize]
        public async Task<IActionResult> JoinOba(int id, [FromBody] JoinObaDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var oba = await _context.Obalar.FindAsync(id);
            if (oba == null) return NotFound("Oba bulunamadı");

            var existingMember = await _context.ObaMembers.FirstOrDefaultAsync(m => m.ObaId == id && m.UserId == userId);
            if (existingMember != null) return Ok(new { success = true });

            if (oba.IsPrivate) {
                if (string.IsNullOrEmpty(oba.JoinPassword) || oba.JoinPassword != dto.Password) {
                    return BadRequest("Yanlış şifre");
                }
            }

            var member = new ObaMember {
                ObaId = id,
                UserId = userId,
                Role = "member"
            };
            _context.ObaMembers.Add(member);
            
            oba.MemberCount += 1;
            
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // DELETE: api/obalar/{id}
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteOba(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var oba = await _context.Obalar.FindAsync(id);
            if (oba == null) return NotFound("Oba bulunamadı");

            // Sadece owner veya admin silebilir
            var member = await _context.ObaMembers.FirstOrDefaultAsync(m => m.ObaId == id && m.UserId == userId);
            if (member == null || (member.Role != "owner" && member.Role != "admin")) {
                return Forbid("Bu obayı silme yetkiniz yok.");
            }

            _context.Obalar.Remove(oba);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
`;

c = c.replace(/    \}\r?\n\}\r?\n?$/, newEndpoints);
fs.writeFileSync('Karalevha.API/Controllers/ObalarController.cs', c);
