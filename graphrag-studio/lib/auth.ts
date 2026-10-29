export const AUTH_COOKIE = "gr_auth";

export async function authToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`graphrag-studio:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
