/**
 * Son açılan oba ve her obanın son açık kanalı (Discord'daki gibi). Tarayıcıda, kişiye göre tutulur:
 * aynı bilgisayarda başka biri giriş yaparsa onun kaydı ayrı olur.
 *
 * Üst menüdeki E-Oba bağlantısı ve ana sayfadaki "Obalara git" bu kayda göre doğrudan son obayı açar.
 */

interface Saved {
  /** Son açılan oba */
  last: number | null;
  /** Oba → o obada en son açık kanal */
  channels: Record<string, number>;
}

const keyOf = (userId: number | null | undefined) => `karalevha:son-oba:${userId ?? 'misafir'}`;

function read(userId: number | null | undefined): Saved {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyOf(userId)) ?? '');
    if (parsed && typeof parsed === 'object') return { last: parsed.last ?? null, channels: parsed.channels ?? {} };
  } catch {
    // bozuk ya da hiç yok
  }
  return { last: null, channels: {} };
}

function write(userId: number | null | undefined, saved: Saved) {
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(saved));
  } catch {
    // depolama kapalıysa hatırlamadan devam
  }
}

/** Obaya girildi ya da kanal değişti */
export function rememberOba(userId: number | null | undefined, obaId: number, channelId?: number) {
  const saved = read(userId);
  saved.last = obaId;
  if (channelId) saved.channels[String(obaId)] = channelId;
  write(userId, saved);
}

/** Oba silindi, kişi ayrıldı ya da artık açılamıyor */
export function forgetOba(userId: number | null | undefined, obaId: number) {
  const saved = read(userId);
  if (saved.last === obaId) saved.last = null;
  delete saved.channels[String(obaId)];
  write(userId, saved);
}

/**
 * Kişi obadan çıkıp oba listesine döndü (geri oku, "Obalara dön" ya da üst menü): artık hiçbir obada
 * değil, E-Oba bağlantısı listeyi açsın. Obaların son kanalları hatırlanmaya devam eder.
 */
export function leaveOba(userId: number | null | undefined) {
  const saved = read(userId);
  if (saved.last === null) return;
  saved.last = null;
  write(userId, saved);
}

/** Bu obada en son açık kanal */
export function lastChannelOf(userId: number | null | undefined, obaId: number): number | null {
  return read(userId).channels[String(obaId)] ?? null;
}

/** E-Oba bağlantısının gideceği yer: son oba (ve kanalı) ya da oba listesi */
export function lastObaPath(userId: number | null | undefined): string {
  const { last, channels } = read(userId);
  if (!last) return '/e-oba';
  const channel = channels[String(last)];
  return `/e-oba/${last}${channel ? `?kanal=${channel}` : ''}`;
}
