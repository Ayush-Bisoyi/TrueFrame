# Design log

This log records implementation decisions and their alternatives. Dates use the local project date, 2026-10-18.

## 2026-10-18 — Browser capture first

I chose a browser capture app with getUserMedia and MediaRecorder over a native mobile build. A native app could provide stronger hardware attestation, but it would multiply platform work and make the wallet-free verifier harder to demonstrate. The browser still supports non-exportable Web Crypto keys and gives the verifier a zero-install path.

## 2026-10-18 — ECDSA P-256

I chose P-256 because it is the required cross-platform curve and is implemented by Web Crypto, Android Keystore, iOS Secure Enclave, and common server libraries. Ed25519 would be simpler in some libraries but would not meet the interoperability requirement.

## 2026-10-18 — IndexedDB CryptoKey storage

The private key is stored as a CryptoKey in IndexedDB and generated with extractable: false. Exporting a private JWK and putting it in localStorage was rejected because it would make accidental exfiltration much easier. IndexedDB also survives page reloads without making the private key serializable to application code.

## 2026-10-18 — Merkle root over 256 KiB chunks

The chunk size is fixed at 256 KiB. Hashing whole files was rejected because it causes avoidable memory pressure on large recordings; chunk hashes also make edited-chunk reporting possible. The tree duplicates the final node on odd levels so every implementation has an unambiguous rule.

## 2026-10-18 — Canonical JSON rather than arbitrary JSON.stringify

JSON.stringify is deterministic only when callers construct keys in the same order. The protocol defines PAYLOAD_FIELDS and reconstructs an object in that exact order before signing. This is a small rule that prevents a subtle cross-platform signature failure.

## 2026-10-18 — Proof metadata includes chunk hashes

The challenge asks the verifier to list which chunks differ. Storing only a Merkle root cannot identify the changed leaves. The signed payload therefore contains the SHA-256 hash of every chunk, never the chunk bytes. This increases metadata size linearly but keeps videos private and makes diagnostics precise.

## 2026-10-18 — Backend-paid EVM anchor

The browser sends a signed payload to the backend; the backend pays gas. Requiring a witness wallet was rejected because it violates the no-wallet verification/capture experience. The private fee key is read only from the server environment and is never bundled by Vite.

## 2026-10-18 — Small event-emitting Solidity contract

The contract stores one timestamp per payload hash and emits a readable memo. Storing the entire payload or video on-chain was rejected because it is expensive, leaks metadata, and is unnecessary: the proof JSON and video can remain off-chain while the chain anchors the hash.

## 2026-10-18 — Explicit mock mode

Local development has a deterministic mock transaction hash when testnet credentials are absent. Silent fake blockchain behavior was rejected. The UI labels this as LOCAL DEMO, and the README explains exactly how to switch to Sepolia.
