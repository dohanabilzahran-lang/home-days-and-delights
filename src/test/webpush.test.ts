// @vitest-environment node
import { describe, expect, it } from "vitest";
import { b64url, encryptPayload, generateVapidKeys, unb64url } from "@/server/webpush.server";

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
type Bytes = Uint8Array<ArrayBuffer>;
async function hmac(key: Bytes, data: Bytes) {
  const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, data));
}
const cat = (...p: Uint8Array[]): Bytes => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

/** Decrypts as a browser would (RFC 8291 receiver side), to prove the sender's output is valid. */
async function decrypt(body: Bytes, ua: CryptoKeyPair, auth: Bytes) {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const uaPublic = new Uint8Array(await subtle.exportKey("raw", ua.publicKey));
  const asKey = await subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
  const ikm = await hmac(await hmac(auth, ecdh), cat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
  expect(plain.at(-1)).toBe(2); // last-record delimiter
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("web push", () => {
  it("base64url round-trips", () => {
    const b = new Uint8Array([0, 255, 62, 63, 1]);
    expect(unb64url(b64url(b))).toEqual(b);
  });
  it("generates a 65-byte public key and 32-byte private key", async () => {
    const k = await generateVapidKeys();
    expect(unb64url(k.publicKey).length).toBe(65);
    expect(unb64url(k.privateKey).length).toBe(32);
  });
  it("encrypts a payload the browser can decrypt", async () => {
    const ua = (await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const p256dh = b64url(await subtle.exportKey("raw", ua.publicKey));
    const msg = JSON.stringify({ title: "واقي الشمس", body: "08:00" });
    const body = await encryptPayload(enc.encode(msg), p256dh, b64url(auth));
    expect(await decrypt(body, ua, auth)).toBe(msg);
  });
});
