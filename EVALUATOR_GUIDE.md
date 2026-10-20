# Evaluator guide

This document is a fast path for reviewing the implementation against the TrueFrame challenge.

## One-minute local review

    pnpm install
    pnpm build
    pnpm test
    pnpm start

Open http://localhost:8787. The local app uses a clearly labelled deterministic mock anchor when no blockchain environment variables are configured.

## What to inspect

1. Capture a short clip with the browser camera and microphone.
2. Enter a district and coordinates. The public proof contains the district and a salted commitment, not the raw coordinates.
3. Download the private location salt.
4. Sign and anchor the proof.
5. On the verification page, select the original local video. It should show Original.
6. Change one byte or re-encode the video and select the copy. It should show Edited and list different chunks.
7. Inspect the browser Network panel during capture and proof creation. The video is not an API request body.
8. Change a stored payload field in data/proofs.json and reload the verification page. The signature check should fail.

## Requirement map

| Challenge requirement | Implementation |
| --- | --- |
| Record video with audio | MediaRecorder over getUserMedia in src/main.js |
| Fixed-size chunking | CHUNK_SIZE = 256 KiB in shared/protocol.mjs |
| SHA-256 and Merkle root | shared/merkle.mjs |
| Non-exportable P-256 device key | src/crypto.js, Web Crypto + IndexedDB |
| Canonical signed payload | PAYLOAD_FIELDS and canonicalPayload |
| Public district, private location seal | createSealedLocation in src/crypto.js |
| Backend-paid blockchain anchor | server/anchor.js |
| Solidity anchor contract | contracts/TrueFrameAnchor.sol |
| Wallet-free verification | /verify/:proofId in src/main.js |
| Direct public-RPC receipt verification | verifyOnChain in src/main.js |
| Original / Edited / Invalid proof | verification result state and chunk diagnostics |
| No video upload | API accepts only payload and signature |

## Real testnet mode

The source is Sepolia-ready. Set RPC_URL, PUBLIC_RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, and BLOCK_EXPLORER_BASE in a deployment environment, then run pnpm deploy:contract once before starting the server. PRIVATE_KEY is server-only and must never be committed.

The UI labels local mode as LOCAL DEMO. It never pretends a mock hash is a public blockchain timestamp.
