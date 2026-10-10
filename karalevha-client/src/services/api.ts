export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5114';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && token) {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  if (res.status === 429) {
    throw new Error('Çok fazla deneme yaptınız, biraz bekleyin.');
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
    throw new Error(errorMsg ?? `İstek başarısız (${res.status})`);
  }
  
  if (res.status === 204) {
    return {} as T;
  }
  
  return res.json().catch(() => ({} as T)) as Promise<T>;
}
