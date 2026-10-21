using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class UpdateProfileDto
    {
        [MaxLength(500, ErrorMessage = "Biyografi en fazla 500 karakter olabilir.")]
        public string? Bio { get; set; }

        [MaxLength(10, ErrorMessage = "En fazla 10 ilgi alanı seçilebilir.")]
        public List<string>? Interests { get; set; }
    }
}
