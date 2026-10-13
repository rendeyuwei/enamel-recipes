import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "caiben_session";
export const SESSION_MAX_AGE_SEC = 14 * 24 * 60 * 60;

export function signSession(id: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(id).digest("hex");
  return `${id}.${sig}`;
}

export function openSession(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return null;
  if (!timingSafeEqual(left, right)) return null;
  return id;
}

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_MAX_AGE_SEC): string {
  const parts = [`${SESSION_COOKIE}=${token}`, "Path=/recipes", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
