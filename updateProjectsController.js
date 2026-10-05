const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Controllers/ProjectsController.cs', 'utf8');

const getById = `
        // GET: api/projects/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProject(int id)
        {
            var p = await _context.Projects
                .Include(pr => pr.User)
                .FirstOrDefaultAsync(pr => pr.Id == id);
            
            if (p == null) return NotFound("Proje bulunamadı");
            
            return Ok(new {
                p.Id,
                p.Title,
                p.Description,
                p.RepoUrl,
                p.Stars,
                p.Forks,
                p.CreatedAt,
                Owner = p.User.Username
            });
        }
`;

c = c.replace('// POST: api/projects', getById + '\n        // POST: api/projects');
fs.writeFileSync('Karalevha.API/Controllers/ProjectsController.cs', c);
