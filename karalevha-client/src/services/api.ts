/**
 * API'nin adresi. Canlıda boş: site ve API aynı adresten görünür (Vercel /api, /uploads ve hub yollarını
 * API'ye yönlendirir, bkz. vercel.json); böylece oturum çerezi birinci taraf çerezi olur.
 * Geliştirmede localhost:5114 (localhost'un portları aynı "site" sayılır, çerez yine gider).
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:5114');

/** Değiştirici isteklerde API'nin aradığı başlık (sahte istek / CSRF koruması) */
const CSRF_HEADER = 'X-KaraLevha';

/** Sunucunun hata yanıtı: mesajın yanında durum kodu ve gövde (ör. requiresVerification) */
export class ApiError extends Error {
  constructor(message: string, public status: number, public body: Record<string, unknown> | null) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API'ye ham istek: oturum çerezi gider (credentials), güvenlik başlığı eklenir. Jeton JavaScript'te
 * hiç durmaz; HttpOnly çerezdedir.
 */
export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set(CSRF_HEADER, '1');
  return fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
}

/** SignalR bağlantılarının ortak ayarı: çerez ve güvenlik başlığı */
export const hubOptions = { withCredentials: true, headers: { [CSRF_HEADER]: '1' } };

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await apiFetch(path, { ...options, headers });

  // Giriş yapmış görünürken oturum düştüyse (süresi doldu, başka yerden çıkıldı) arayüz de çıksın
  if (res.status === 401 && localStorage.getItem('user')) {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  if (res.status === 429) {
    // Sunucu bir açıklama verdiyse (ör. hesap için kaç dakika kaldı) onu göster
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Çok fazla deneme yaptınız, biraz bekleyin.', 429, body);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    let errorMsg = body?.message;
    if (!errorMsg && body?.errors && typeof body.errors === 'object') {
      const firstKey = Object.keys(body.errors)[0];
      if (firstKey && Array.isArray(body.errors[firstKey]) && body.errors[firstKey].length > 0) {
        errorMsg = body.errors[firstKey][0];
      }
    }
    if (!errorMsg && body?.title) {
      errorMsg = body.title;
    }
    throw new ApiError(errorMsg ?? `İstek başarısız (${res.status})`, res.status, body);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
