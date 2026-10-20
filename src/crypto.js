import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToHex,
  canonicalPayload,
  normaliseCoordinate
} from "../shared/protocol.mjs";

const DB_NAME = "trueframe-device";
const STORE_NAME = "keys";
const KEY_ID = "capture-key-v1";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readKeyRecord() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY_ID);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeKeyRecord(record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record, KEY_ID);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOrCreateDeviceKey() {
  const existing = await readKeyRecord();
  if (existing?.privateKey && existing.publicJwk) return existing;

  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const record = { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, publicJwk };
  await writeKeyRecord(record);
  return record;
}

export async function signPayload(payload) {
  const record = await getOrCreateDeviceKey();
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    record.privateKey,
    new TextEncoder().encode(canonicalPayload(payload))
  );
  return { signature: bytesToBase64Url(signature), publicJwk: record.publicJwk };
}

export async function verifyPayloadSignature(payload, signature) {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    payload.devicePublicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64UrlToBytes(signature),
    new TextEncoder().encode(canonicalPayload(payload))
  );
}

export async function signedPayloadHash(payload) {
  const bytes = new TextEncoder().encode(canonicalPayload(payload));
  return bytesToHex(await crypto.subtle.digest("SHA-256", bytes));
}

export async function createSealedLocation(latitude, longitude) {
  const lat = normaliseCoordinate(latitude);
  const lon = normaliseCoordinate(longitude);
  const saltBytes = crypto.getRandomValues(new Uint8Array(18));
  const salt = bytesToBase64Url(saltBytes);
  const input = new TextEncoder().encode(lat + "|" + lon + "|" + salt);
  const commitment = bytesToHex(await crypto.subtle.digest("SHA-256", input));
  return { lat, lon, salt, commitment };
}

export function downloadLocationSalt(location) {
  const text = [
    "TrueFrame private location salt",
    "Keep this file private. It is not uploaded with the proof.",
    "latitude=" + location.lat,
    "longitude=" + location.lon,
    "salt=" + location.salt,
    "commitment=" + location.commitment
  ].join("\n") + "\n";
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trueframe-location-salt.txt";
  link.click();
  URL.revokeObjectURL(url);
}
