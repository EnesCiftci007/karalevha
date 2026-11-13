const relative = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });

/** "3 gün önce", "dün" gibi kısa zaman ifadesi. */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'az önce';
}

/** Fareyle üzerine gelince gösterilen tam tarih: "11 Kasım 2026 18:52". */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
