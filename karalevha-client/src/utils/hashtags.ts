/*
 * Hashtag kuralları: sunucudaki PostTags ile aynı (Models/UserFollow.cs).
 * Önünde harf, rakam, &, @ ya da / olmayan # ve ardından 2–30 harf, rakam ya da _.
 */
export const HASHTAG = /(?<![\p{L}\p{N}_&#@/])#([\p{L}\p{N}_]{2,30})/gu;

const TURKISH_LETTERS = /[çğışöüÇĞİŞÖÜ]/;

/** "#Robotik" → "robotik". Türkçe harfli kelimede Türkçe küçültme ("IŞIK" → "ışık"), diğerlerinde genel ("ARDUINO" → "arduino"). */
export function normalizeTag(tag: string): string {
  const word = tag.trim().replace(/^#/, '');
  const lower = TURKISH_LETTERS.test(word) ? word.toLocaleLowerCase('tr') : word.toLowerCase();
  return lower.replace(/[^\p{L}\p{N}_]/gu, '');
}

/** Metindeki etiketler, tekrarsız (en fazla 5; sunucu da 5 tane alır) */
export function extractTags(text: string, max = 5): string[] {
  const tags: string[] = [];
  for (const m of text.matchAll(HASHTAG)) {
    const tag = normalizeTag(m[1]);
    if (tag.length >= 2 && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= max) break;
  }
  return tags;
}
