# TrueFrame

TrueFrame is a privacy-first video provenance prototype for the GDG × Iris recruitment challenge. It does not try to guess whether a video “looks AI-generated”. Instead, it creates a verifiable chain of evidence at capture time:

    camera + microphone
            │
            ▼
    256 KiB chunks → SHA-256 chunk hashes → Merkle root
            │                                      │
            ├─ signed by non-exportable P-256 key  │
            │                                      │
            └──────── signed payload hash ─────────┴─ EVM testnet anchor

The video never leaves the browser. The backend receives only the proof payload and signature. In local mode the backend uses a deterministic mock anchor so the complete capture/verify flow can be demonstrated without a wallet. With the environment variables below, the same code submits a real transaction to an EVM testnet.

## What is implemented

- Browser capture through getUserMedia and MediaRecorder, including audio.
- Fixed 256 KiB chunking and SHA-256 hashing with the Web Crypto API.
- A deterministic binary Merkle tree: each pair is SHA-256(leftHash || rightHash) and an odd final node is duplicated.
- A P-256 ECDSA key pair generated once per browser profile. The private key is generated with extractable: false and persisted as a CryptoKey in IndexedDB.
- Explicit canonical JSON field order before signing. This avoids verification failures caused by different JSON key ordering.
- District-only public location plus a salted commitment of six-decimal coordinates. The salt is downloadable to the witness and is never sent to the API.
- A small Solidity contract that stores only a timestamp and emits trueframe:v1:<sha256(signed payload)>.
- A server-side fee payer. The frontend cannot see or use the testnet private key.
- Shareable /verify/<proofId> page. The alleged video is hashed in the browser, the signature is checked, the anchor is read directly from a public RPC, and changed chunk numbers are shown.
- Tests for canonical encoding, Merkle behavior, signatures, coordinate normalization, and contract compilation.

## Run locally

Prerequisites: Node.js 20 or newer.

    cp .env.example .env
    pnpm install
    pnpm build
    pnpm start

Open http://localhost:8787. Camera and geolocation APIs require a secure context in production; localhost is treated as secure by modern browsers.

In local mode, leave the chain variables as placeholders. A proof will show LOCAL DEMO. This is intentionally visible: a mock hash is not presented as a blockchain transaction.

Run the tests:

    pnpm test

## Real Sepolia deployment

1. Create a testnet-only EVM account and fund it with Sepolia ETH. Never use a mainnet key.
2. Set RPC_URL and PRIVATE_KEY in .env.
3. Deploy the contract:

       pnpm deploy:contract

4. Copy the printed address into CONTRACT_ADDRESS.
5. Set PUBLIC_RPC_URL to the public RPC endpoint that browsers may use. This value is not a secret.
6. Set BLOCK_EXPLORER_BASE=https://sepolia.etherscan.io.
7. Build and start again:

       pnpm build && pnpm start

The deploy script compiles contracts/TrueFrameAnchor.sol, deploys it, and prints its address. The API calls anchor(bytes32) from the fee-paying server wallet. The emitted event contains the required trueframe:v1: prefix. The browser verification page independently fetches the transaction receipt and parses that event.

For a public deployment, use any Node-compatible host that supports a persistent disk for data/proofs.json (or replace that tiny store with Postgres/S3 metadata). Set the start command to pnpm start, build command to pnpm build, and copy only the non-secret environment variables into the host. Do not place PRIVATE_KEY in Vite client variables or a static site.

## End-to-end demo

1. Open Capture and click Enable camera.
2. Record a short clip, then click Stop.
3. Enter the public district and exact coordinates. Use my location is optional.
4. Download the private location salt and keep it with the witness.
5. Click Sign & anchor proof. The app hashes and signs locally; only the proof is posted.
6. The app redirects to /verify/<proofId>.
7. Select the original .webm file. The result should be Original.
8. Create an edited test: duplicate the file, flip one byte or change its contents, and select the copy. The result should be Edited, with different chunk numbers.
9. For an invalid proof test, edit the stored payload in data/proofs.json and reload. The P-256 signature check should fail. Restore the file afterward.
10. In EVM mode, open the transaction link and show the ProofAnchored event.

Do not claim that local mock mode proves a public blockchain timestamp. It only makes the application testable without testnet funds.

## Verification states

| Result | Meaning |
| --- | --- |
| Original | Signature, chain event, file size, all chunk hashes, and Merkle root agree. |
| Edited | The signed proof is valid, but the selected file differs. The UI lists differing chunk numbers. |
| Invalid proof | The payload signature, transaction, contract, or event does not match the proof. |

The system proves that a particular device key signed this exact byte sequence by the time the signed hash was anchored. It does not prove that the scene was not staged, that the device owner was truthful, or that the recording itself is admissible evidence.

## Privacy and threat model

- No account, name, phone number, or wallet is collected.
- Exact latitude and longitude are never sent to the server. The public payload contains only a district and SHA-256(lat|lon|salt) with latitude and longitude normalized to six decimal places.
- The witness receives the salt as a local download. Anyone with the salt and coordinates can test a location guess, so the witness should protect the salt.
- The video is never an API request body. The server stores JSON proof metadata only.
- A compromised browser profile can use the device key while it is available, but cannot export the private key through this app.
- A stolen proof can be copied, but it cannot be changed without invalidating the signature.
- A server operator can refuse to anchor or delete a proof from the local database. A real chain receipt remains independently verifiable once it exists.

## Project map

    src/main.js                  capture UI, verify UI, on-chain receipt checks
    src/crypto.js                IndexedDB key lifecycle, P-256 signatures, location seal
    shared/protocol.mjs          canonical payload and encoding rules
    shared/merkle.mjs            SHA-256 chunking and Merkle root
    server/index.js              proof API, signature gate, JSON metadata store
    server/anchor.js             EVM anchor + explicit local mock fallback
    contracts/TrueFrameAnchor.sol minimal timestamp/event contract
    scripts/deploy-contract.mjs  testnet deployment
    test/                        protocol and Solidity compilation tests

## References

- Challenge: https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/TrueFrame.md
- MDN SubtleCrypto: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- Ethereum Sepolia: https://ethereum.org/en/developers/docs/networks/#sepolia
- Solidity documentation: https://docs.soliditylang.org/
- C2PA specifications: https://c2pa.org/specifications/specifications/2.1/index.html
