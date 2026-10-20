export const PROTOCOL_VERSION = 1;
export const CHUNK_SIZE = 256 * 1024;

// Keep this list explicit. Both the browser and server must produce exactly
// the same bytes before signing/verifying a proof.
export const PAYLOAD_FIELDS = [
  "version",
  "proofId",
  "merkleRoot",
  "chunkHashes",
  "chunkSize",
  "fileSize",
  "capturedAt",
  "district",
  "locationCommitment",
  "devicePublicKey"
];

export function canonicalPayload(payload) {
  const ordered = {};
  for (const field of PAYLOAD_FIELDS) {
    if (!(field in payload)) throw new Error("Missing payload field: " + field);
    ordered[field] = payload[field];
  }
  return JSON.stringify(ordered);
}

export function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex) {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToBase64Url(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function normaliseCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < -180 || number > 180) {
    throw new Error("Coordinates must be valid numbers");
  }
  return number.toFixed(6);
}
