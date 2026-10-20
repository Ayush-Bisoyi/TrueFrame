import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { canonicalPayload, normaliseCoordinate } from "../shared/protocol.mjs";
import { merkleRoot, hashFileInChunks } from "../shared/merkle.mjs";

const cryptoApi = globalThis.crypto ?? webcrypto;

const basePayload = {
  version: 1,
  proofId: "00000000-0000-4000-8000-000000000001",
  merkleRoot: "a".repeat(64),
  chunkHashes: ["b".repeat(64)],
  chunkSize: 262144,
  fileSize: 3,
  capturedAt: "2026-10-18T00:00:00.000Z",
  district: "Surathkal, Karnataka",
  locationCommitment: "c".repeat(64),
  devicePublicKey: { kty: "EC", crv: "P-256", x: "x", y: "y", ext: true }
};

test("canonical payload has fixed key order", () => {
  const reversed = Object.fromEntries(Object.entries(basePayload).reverse());
  assert.equal(canonicalPayload(basePayload), canonicalPayload(reversed));
  assert.match(canonicalPayload(basePayload), /^{"version":1,"proofId"/);
});

test("Merkle root changes when a chunk changes", async () => {
  const first = await merkleRoot(["00".repeat(32), "11".repeat(32)]);
  const second = await merkleRoot(["00".repeat(32), "12".repeat(32)]);
  assert.equal(first.length, 64);
  assert.notEqual(first, second);
});

test("chunk hashing is deterministic and uses the requested chunk size", async () => {
  const file = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
  const result = await hashFileInChunks(file, 2);
  assert.equal(result.chunkHashes.length, 3);
  assert.equal(result.merkleRoot.length, 64);
});

test("P-256 signatures verify the exact canonical bytes", async () => {
  const keyPair = await cryptoApi.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const publicJwk = await cryptoApi.subtle.exportKey("jwk", keyPair.publicKey);
  const payload = { ...basePayload, devicePublicKey: publicJwk };
  const bytes = new TextEncoder().encode(canonicalPayload(payload));
  const signature = await cryptoApi.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, bytes);
  const imported = await cryptoApi.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.equal(await cryptoApi.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, imported, signature, bytes), true);
  assert.equal(await cryptoApi.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, imported, signature, new TextEncoder().encode(canonicalPayload({ ...payload, fileSize: 4 }))), false);
});

test("location coordinate encoding is fixed to six decimals", () => {
  assert.equal(normaliseCoordinate("12.9"), "12.900000");
  assert.throws(() => normaliseCoordinate("not-a-number"));
});
