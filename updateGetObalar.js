const fs = require('fs');

let content = fs.readFileSync('Karalevha.API/Controllers/ObalarController.cs', 'utf8');

const regex = /public async Task<IActionResult> GetObalar\(\)[\s\S]*?return Ok\(obalar\);\s*\}/;

const newMethod = `public async Task<IActionResult> GetObalar()
        {
            var obalar = await _context.Obalar
                .Select(o => new
                {
                    o.Id,
                    o.Name,
                    o.Description,
                    o.AvatarSeed,
                    o.Color,
                    o.MemberCount,
                    o.IsPrivate
                })
                .ToListAsync();

            var rnd = new Random();
            return Ok(obalar.OrderBy(x => rnd.Next()).ToList());
        }`;

content = content.replace(regex, newMethod);
fs.writeFileSync('Karalevha.API/Controllers/ObalarController.cs', content);
