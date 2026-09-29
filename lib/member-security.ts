const encoder = new TextEncoder();
function hex(bytes: Uint8Array) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""); }
export async function hashTc(tc: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`fit-n-stop:${tc}`)))); }
export async function hashPassword(password: string, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  return { hash: hex(new Uint8Array(bits)), salt };
}
export function temporaryPassword() { const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes=new Uint8Array(8); crypto.getRandomValues(bytes); return Array.from(bytes,b=>chars[b%chars.length]).join(""); }
