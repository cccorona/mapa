/** Session cookie: compatible with Edge Runtime (Web Crypto, no Node crypto/Buffer). */

const COOKIE_NAME = "session"
const MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 days
const SEP = "."

export type SessionPayload = {
  userId: string
  email: string
  exp: number
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters")
  }
  return secret
}

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

function bytesToBase64url(bytes: Uint8Array): string {
  let result = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    result += BASE64URL_ALPHABET[a >>> 2]!
    result += BASE64URL_ALPHABET[((a & 3) << 4) | (b ?? 0) >>> 4]!
    result += b === undefined ? "" : BASE64URL_ALPHABET[((b & 15) << 2) | (c ?? 0) >>> 6]!
    result += c === undefined ? "" : BASE64URL_ALPHABET[c & 63]!
  }
  return result
}

function base64urlToBytes(str: string): Uint8Array {
  const len = Math.floor((str.length * 3) / 4)
  if (str.length % 4 === 1) throw new Error("Invalid base64url")
  const out = new Uint8Array(len)
  const rev: Record<string, number> = {}
  for (let i = 0; i < BASE64URL_ALPHABET.length; i++) {
    rev[BASE64URL_ALPHABET[i]!] = i
  }
  let i = 0
  for (let j = 0; j < str.length; j += 4) {
    const n0 = rev[str[j]!] ?? -1
    const n1 = rev[str[j + 1]!] ?? -1
    const n2 = rev[str[j + 2]!] ?? -1
    const n3 = rev[str[j + 3]!] ?? -1
    if (n0 < 0 || n1 < 0) throw new Error("Invalid base64url")
    out[i++] = (n0 << 2) | (n1 >>> 4)
    if (n2 >= 0 && i < len) out[i++] = ((n1 & 15) << 4) | (n2 >>> 2)
    if (n3 >= 0 && i < len) out[i++] = ((n2 & 3) << 6) | n3
  }
  return out
}

async function sign(value: string): Promise<string> {
  const secret = getSecret()
  const keyData = new TextEncoder().encode(secret)
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const data = new TextEncoder().encode(value)
  const sig = await crypto.subtle.sign("HMAC", key, data)
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return hex
}

async function verify(value: string, signature: string): Promise<boolean> {
  const expected = await sign(value)
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

export async function createSessionCookie(payload: SessionPayload): Promise<string> {
  const data = JSON.stringify({
    userId: payload.userId,
    email: payload.email,
    exp: payload.exp,
  })
  const b64 = bytesToBase64url(new TextEncoder().encode(data))
  const sig = await sign(b64)
  return `${b64}${SEP}${sig}`
}

export async function parseSessionCookie(cookieValue: string): Promise<SessionPayload | null> {
  const idx = cookieValue.lastIndexOf(SEP)
  if (idx === -1) return null
  const b64 = cookieValue.slice(0, idx)
  const sig = cookieValue.slice(idx + 1)
  const ok = await verify(b64, sig)
  if (!ok) return null
  try {
    const bytes = base64urlToBytes(b64)
    const data = JSON.parse(new TextDecoder().decode(bytes)) as SessionPayload
    if (
      typeof data.userId !== "string" ||
      typeof data.email !== "string" ||
      typeof data.exp !== "number"
    ) {
      return null
    }
    if (data.exp < Date.now() / 1000) return null
    return data
  } catch {
    return null
  }
}

export async function getSessionFromRequest(
  cookieHeader: string | null
): Promise<SessionPayload | null> {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(";").map((c) => c.trim())
  const sessionCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`))
  if (!sessionCookie) return null
  const value = sessionCookie.slice(COOKIE_NAME.length + 1).trim()
  return parseSessionCookie(value)
}

export function getSessionCookieName(): string {
  return COOKIE_NAME
}

export function getSessionCookieOptions(): {
  maxAge: number
  httpOnly: true
  path: string
  sameSite: "lax"
} {
  return {
    maxAge: MAX_AGE_SEC,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  }
}

export function buildSessionPayload(userId: string, email: string): SessionPayload {
  return {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  }
}
