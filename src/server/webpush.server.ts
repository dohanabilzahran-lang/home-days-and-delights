/**
 * Web Push with only Web Crypto (works on Cloudflare Workers and Node 20+):
 * - payload encryption: RFC 8291 (aes128gcm)
 * - sender identification: RFC 8292 (VAPID, ES256 JWT)
 * No secrets are logged. VAPID keys are generated once and stored server-side (see config.ts).
 */

type Bytes = Uint8Array<ArrayBuffer>;
const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

export function b64url(bytes: ArrayBuffer | Uint8Array) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64url(s: string): Bytes {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
async function hmac(key: Bytes, data: Bytes) {
  const k = await subtle().importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle().sign("HMAC", k, data));
}

export type VapidKeys = { publicKey: string; privateKey: string }; // base64url: 65-byte raw public, 32-byte d

export async function generateVapidKeys(): Promise<VapidKeys> {
  const kp = (await subtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle().exportKey("raw", kp.publicKey));
  const jwk = await subtle().exportKey("jwk", kp.privateKey);
  return { publicKey: b64url(raw), privateKey: jwk.d as string };
}

async function vapidJwt(endpoint: string, keys: VapidKeys, subject: string) {
  const pub = unb64url(keys.publicKey);
  const key = await subtle().importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: keys.privateKey, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await subtle().sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(sig)}`;
}

/** Encrypts a payload for one subscription (RFC 8291). Returns the request body. */
export async function encryptPayload(payload: Bytes, p256dh: string, auth: string, salt: Bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = unb64url(p256dh);
  const authSecret = unb64url(auth);
  const as = (await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await subtle().exportKey("raw", as.publicKey));
  const uaKey = await subtle().importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle().deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));

  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aes = await subtle().importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export type PushResult = { ok: boolean; status: number; gone: boolean };

/** Sends one notification. `gone` = the subscription no longer exists and should be deleted. */
export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  message: { title: string; body?: string; url?: string; tag?: string },
  keys: VapidKeys,
  subject = "mailto:nest@example.invalid",
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
      Authorization: `vapid t=${await vapidJwt(sub.endpoint, keys, subject)}, k=${keys.publicKey}`,
    },
    body,
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
