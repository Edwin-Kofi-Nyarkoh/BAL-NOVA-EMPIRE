import crypto from "crypto"

const key = process.env.SETTINGS_ENCRYPTION_KEY || ""

function getKeyBuffer() {
  if (!key) return null
  if (key.length === 64) {
    return Buffer.from(key, "hex")
  }
  if (key.length >= 32) {
    return Buffer.from(key.slice(0, 32))
  }
  return null
}

export function encryptValue(value: string) {
  const keyBuf = getKeyBuffer()
  if (!keyBuf) return value
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptValue(value: string) {
  const keyBuf = getKeyBuffer()
  if (!keyBuf) return value
  try {
    const buf = Buffer.from(value, "base64")
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const encrypted = buf.subarray(28)
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString("utf8")
  } catch {
    return value
  }
}
