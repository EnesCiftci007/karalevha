const fs = require('fs');

let content = fs.readFileSync('Karalevha.API/Controllers/ObalarController.cs', 'utf8');

// 1. Add BCrypt reference if not present
if (!content.includes('using BCrypt.Net;')) {
    content = 'using BCrypt.Net;\n' + content;
}

// 2. Patch CreateOba for Hashing and Member addition
const createObaRegex = /JoinPassword = dto\.JoinPassword,([\s\S]*?await _context\.SaveChangesAsync\(\); \/\/ get Oba Id)/;
content = content.replace(createObaRegex, `JoinPassword = string.IsNullOrEmpty(dto.JoinPassword) ? null : BCrypt.Net.BCrypt.EnhancedHashPassword(dto.JoinPassword),$1
            
            // Kurucuyu otomatik admin üye yap
            _context.ObaMembers.Add(new ObaMember {
                ObaId = oba.Id,
                UserId = userId,
                Role = "admin"
            });
            await _context.SaveChangesAsync();
`);

// 3. Patch JoinOba for verification
const joinRegex = /if \(string\.IsNullOrEmpty\(oba\.JoinPassword\) \|\| oba\.JoinPassword != dto\.Password\) \{/;
content = content.replace(joinRegex, `if (string.IsNullOrEmpty(oba.JoinPassword)) return BadRequest("Yanlış şifre");
                
                bool isValid = false;
                try {
                    isValid = BCrypt.Net.BCrypt.EnhancedVerify(dto.Password, oba.JoinPassword);
                } catch {
                    // Fallback for old plaintext passwords
                    isValid = (oba.JoinPassword == dto.Password);
                }
                
                if (!isValid) {`);

fs.writeFileSync('Karalevha.API/Controllers/ObalarController.cs', content);
