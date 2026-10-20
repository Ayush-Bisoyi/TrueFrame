import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { anchorProof, publicChainConfig } from "./anchor.js";
import { canonicalPayload, PAYLOAD_FIELDS, PROTOCOL_VERSION, CHUNK_SIZE } from "../shared/protocol.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const proofsFile = path.join(dataDir, "proofs.json");
const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "8mb" }));

async function readProofs() {
  try {
    return JSON.parse(await fs.readFile(proofsFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(proofsFile, "[]\n", "utf8");
    return [];
  }
}

async function writeProofs(proofs) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(proofsFile, JSON.stringify(proofs, null, 2) + "\n", "utf8");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isHex(value, length) {
  return typeof value === "string" && new RegExp("^[0-9a-f]{" + length + "}$", "i").test(value);
}

function validatePayload(payload) {
  if (!payload || payload.version !== PROTOCOL_VERSION) throw new Error("Unsupported protocol version");
  if (!/^[0-9a-f-]{20,80}$/i.test(payload.proofId)) throw new Error("Invalid proof id");
  if (!isHex(payload.merkleRoot, 64)) throw new Error("Invalid Merkle root");
  if (!Array.isArray(payload.chunkHashes) || payload.chunkHashes.length > 100000) throw new Error("Invalid chunk hash list");
  if (!payload.chunkHashes.every((hash) => isHex(hash, 64))) throw new Error("Invalid chunk hash");
  if (payload.chunkSize !== CHUNK_SIZE) throw new Error("Unexpected chunk size");
  if (!Number.isInteger(payload.fileSize) || payload.fileSize < 1) throw new Error("Invalid file size");
  if (typeof payload.capturedAt !== "string" || Number.isNaN(Date.parse(payload.capturedAt))) throw new Error("Invalid capture time");
  if (typeof payload.district !== "string" || payload.district.trim().length < 2 || payload.district.length > 120) throw new Error("Invalid district");
  if (!isHex(payload.locationCommitment, 64)) throw new Error("Invalid location commitment");
  if (!payload.devicePublicKey || payload.devicePublicKey.kty !== "EC" || payload.devicePublicKey.crv !== "P-256") {
    throw new Error("Only P-256 device keys are supported");
  }
}

async function verifySignature(payload, signature) {
  const key = await crypto.webcrypto.subtle.importKey(
    "jwk",
    payload.devicePublicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  return crypto.webcrypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    Buffer.from(signature, "base64url"),
    Buffer.from(canonicalPayload(payload), "utf8")
  );
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "trueframe-api", chain: publicChainConfig() });
});

app.get("/api/config", (_request, response) => {
  response.json(publicChainConfig());
});

app.get("/api/proofs/:proofId", async (request, response) => {
  try {
    const proofs = await readProofs();
    const proof = proofs.find((item) => item.proofId === request.params.proofId);
    if (!proof) return response.status(404).json({ error: "Proof not found" });
    return response.json(proof);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

app.post("/api/proofs", async (request, response) => {
  try {
    const { payload, signature } = request.body || {};
    validatePayload(payload);
    if (typeof signature !== "string" || signature.length < 80) throw new Error("Invalid signature");
    const proofs = await readProofs();
    if (proofs.some((item) => item.proofId === payload.proofId)) throw new Error("Proof id already exists");
    if (!(await verifySignature(payload, signature))) throw new Error("Signature does not match device public key");

    const canonical = canonicalPayload(payload);
    const signedPayloadHash = sha256Hex(canonical);
    const anchor = await anchorProof(signedPayloadHash);
    const proof = {
      proofId: payload.proofId,
      payload,
      signature,
      signedPayloadHash,
      anchor,
      createdAt: new Date().toISOString()
    };
    proofs.push(proof);
    await writeProofs(proofs);
    return response.status(201).json(proof);
  } catch (error) {
    console.error("[proof rejected]", error);
    return response.status(400).json({ error: error.message || "Unable to create proof" });
  }
});

const distDir = path.join(rootDir, "dist");
app.use(express.static(distDir));
app.get("*", async (request, response, next) => {
  if (request.path.startsWith("/api/")) return next();
  return response.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.listen(port, () => {
  console.log("TrueFrame listening at http://localhost:" + port);
  console.log("Anchor mode:", publicChainConfig().mode);
});
