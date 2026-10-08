const fs = require('fs');
const file = 'Karalevha.API/Controllers/ObalarController.cs';
let content = fs.readFileSync(file, 'utf8');

const regex = /\.Select\(o => new\s*\{\s*o\.Id,\s*o\.Name,\s*o\.Description,\s*o\.AvatarSeed,\s*o\.Color,\s*o\.MemberCount,\s*o\.IsPrivate\s*\}\)/m;

const replacement = `.Select(o => new
                {
                    o.Id,
                    o.Name,
                    o.Description,
                    o.AvatarSeed,
                    o.Color,
                    o.MemberCount,
                    o.IsPrivate,
                    Owner = o.Owner != null ? o.Owner.Username : "Bilinmeyen"
                })`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
