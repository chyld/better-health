/** A random session token: 32 bytes, base64url. */
export function generateToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

/** Only this hash is stored, so a leaked database cannot be used to hijack sessions. */
export function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}
