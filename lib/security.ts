const encoder = new TextEncoder();
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
export async function digest(s: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(s))),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export function validatePassword(p: string) {
  if (
    typeof p !== "string" ||
    p.length < 6 ||
    p.length > 128
  )
    throw new Error("密碼需為 6–128 字元");
}
async function derive(p: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(p),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: encoder.encode(salt),
          iterations: 100000,
          hash: "SHA-256",
        },
        key,
        256,
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hashPassword(p: string) {
  validatePassword(p);
  const salt = randomToken();
  return salt + ":" + (await derive(p, salt));
}
export async function verifyPassword(p: string, stored: string) {
  if (typeof p !== "string" || p.length > 128) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const value = await derive(p, salt);
  let diff = hash.length ^ value.length;
  for (let i = 0; i < value.length; i++)
    diff |= value.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return diff === 0;
}
