import { scryptSync, randomBytes, timingSafeEqual } from "crypto"

const SALT_LEN = 16
const KEY_LEN = 64
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 }

function toHex(buf: Buffer): string {
  return buf.toString("hex")
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex")
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS)
  return `${toHex(salt)}:${toHex(hash)}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":")
  if (!saltHex || !hashHex) return false
  const salt = fromHex(saltHex)
  const hash = fromHex(hashHex)
  const derived = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS)
  return hash.length === derived.length && timingSafeEqual(hash, derived)
}
