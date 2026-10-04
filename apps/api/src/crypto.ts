/** Random tokens and their hashes (Web Crypto: works in Workers and Node). */

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

/** 256 bits of randomness, hex-encoded. */
export function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/** Only hashes of tokens are stored, so a database leak can't be replayed as sessions. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return toHex(new Uint8Array(digest))
}
