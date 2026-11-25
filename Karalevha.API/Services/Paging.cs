using System.Buffers.Text;
using System.Linq.Expressions;
using System.Text.Json;

namespace Karalevha.API.Services
{
    /// <summary>Sıralama anahtarı hesaplanmış bir kayıt: N büyükten küçüğe, sonra T yeniden eskiye, sonra Id</summary>
    public class Keyed<TItem>
    {
        public required TItem Item { get; init; }
        public long N { get; init; }
        public DateTime T { get; init; }
        public int Id { get; init; }
        public string S { get; init; } = string.Empty;
    }

    /// <summary>
    /// Kaldığı yerden devam eden (cursor) sayfalama. Cursor, son kaydın sıralama anahtarıdır; sayfa numarası
    /// değil. Bu yüzden arada yeni kayıt eklense de aynı kayıt iki kez gelmez ya da atlanmaz (sıralamanın
    /// kendisi değişmedikçe; beğeni sayısı gibi değişen anahtarlarda istemci tekrarları kimliğe göre ayıklar).
    /// </summary>
    public static class Paging
    {
        public const int DefaultLimit = 20;
        public const int MaxLimit = 50;

        public sealed record Cursor(string Sort, long N, string? S, long T, int Id, long? Since);

        public static int Clamp(int? limit) => Math.Clamp(limit ?? DefaultLimit, 1, MaxLimit);

        public static string Encode(Cursor c) => Base64Url.EncodeToString(JsonSerializer.SerializeToUtf8Bytes(c));

        /// <summary>Bozuk ya da başka bir sıralamaya ait cursor: null (istek 400 ile reddedilir)</summary>
        public static Cursor? Decode(string? value, string sort)
        {
            if (string.IsNullOrEmpty(value) || value.Length > 1000) return null;
            try
            {
                var c = JsonSerializer.Deserialize<Cursor>(Base64Url.DecodeFromChars(value));
                return c != null && c.Sort == sort ? c : null;
            }
            catch (Exception e) when (e is FormatException or JsonException)
            {
                return null;
            }
        }

        /// <summary>Cursor'dan sonraki kayıtlar: (N azalan, T azalan, Id azalan)</summary>
        public static IQueryable<Keyed<T>> AfterDesc<T>(this IQueryable<Keyed<T>> q, Cursor? c)
        {
            if (c == null) return q;
            var t = new DateTime(c.T, DateTimeKind.Utc);
            return q.Where(x => x.N < c.N || (x.N == c.N && (x.T < t || (x.T == t && x.Id < c.Id))));
        }

        public static IOrderedQueryable<Keyed<T>> OrderDesc<T>(this IQueryable<Keyed<T>> q) =>
            q.OrderByDescending(x => x.N).ThenByDescending(x => x.T).ThenByDescending(x => x.Id);

        /// <summary>Cursor'dan sonraki kayıtlar: (S artan, Id artan) — ada göre sıralama</summary>
        public static IQueryable<Keyed<T>> AfterAsc<T>(this IQueryable<Keyed<T>> q, Cursor? c) =>
            c == null ? q : q.Where(x => string.Compare(x.S, c.S!) > 0 || (x.S == c.S && x.Id > c.Id));

        public static IOrderedQueryable<Keyed<T>> OrderAsc<T>(this IQueryable<Keyed<T>> q) =>
            q.OrderBy(x => x.S).ThenBy(x => x.Id);

        /// <summary>Sayfanın anahtarları: limit+1 okunur, fazlası varsa son kaydın anahtarı sonraki cursor olur</summary>
        public sealed record Key(int Id, long N, DateTime T, string S);

        public static Expression<Func<Keyed<T>, Key>> KeyOf<T>() => x => new Key(x.Id, x.N, x.T, x.S);

        public static (List<int> Ids, string? Next) Cut(List<Key> rows, int limit, string sort, long? since = null)
        {
            var page = rows.Take(limit).ToList();
            string? next = null;
            if (rows.Count > limit)
            {
                var last = page[^1];
                next = Encode(new Cursor(sort, last.N, last.S, DateTime.SpecifyKind(last.T, DateTimeKind.Utc).Ticks, last.Id, since));
            }
            return (page.Select(k => k.Id).ToList(), next);
        }

        /// <summary>Kimliğe göre okunmuş kayıtları sayfanın sırasına dizer</summary>
        public static List<object> InOrder(IEnumerable<object> items, List<int> ids)
        {
            var byId = items.ToDictionary(o => (int)o.GetType().GetProperty("Id")!.GetValue(o)!);
            return ids.Where(byId.ContainsKey).Select(id => byId[id]).ToList();
        }
    }
}
