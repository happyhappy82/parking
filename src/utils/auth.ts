const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || 'admin1234';
const TOKEN_SECRET = import.meta.env.TOKEN_SECRET || 'parkingmap-secret-key-2026';

// 간단한 HMAC-like 토큰 생성 (Web Crypto API 사용)
async function createHmac(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function verifyPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export async function createToken(): Promise<string> {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24, // 24시간
  };
  const data = btoa(JSON.stringify(payload));
  const sig = await createHmac(data, TOKEN_SECRET);
  return `${data}.${sig}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return false;

    const expectedSig = await createHmac(data, TOKEN_SECRET);
    if (sig !== expectedSig) return false;

    const payload = JSON.parse(atob(data));
    if (payload.exp < Date.now()) return false;

    return payload.role === 'admin';
  } catch {
    return false;
  }
}
