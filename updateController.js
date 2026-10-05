const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ObalarController.cs', 'utf8');
c = c.replace('o.MemberCount,', 'o.MemberCount, o.IsPrivate,');
c = c.replace('OwnerId = userId,', 'OwnerId = userId, IsPrivate = dto.IsPrivate,');
c = c.replace('_context.ObaChannels.Add(defaultChannel);\r\n            await _context.SaveChangesAsync();', '_context.ObaChannels.Add(defaultChannel);\r\n            _context.ObaMembers.Add(new ObaMember { ObaId = oba.Id, UserId = userId, Role = "owner" });\r\n            await _context.SaveChangesAsync();');
c = c.replace('oba.MemberCount,', 'oba.MemberCount, oba.IsPrivate,');
fs.writeFileSync('Karalevha.API/Controllers/ObalarController.cs', c);
