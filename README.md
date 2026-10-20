# TrueFrame

## My submission for the GDG × Iris TrueFrame challenge

TrueFrame is my implementation of a privacy-first video provenance system. I designed it to answer a specific question:

> Is this exactly the file that a particular device signed, and did that proof exist by the time it was anchored?

My system does not try to guess whether a video looks artificial. Instead, it creates cryptographic evidence at the time of recording. The video remains in the browser, while a signed fingerprint of the video is anchored on an EVM blockchain testnet.

## Problem I addressed

Deepfake detectors produce probabilities and can become outdated as generation technology improves. They also do not help much when genuine footage is falsely called fake.

I approached the problem as a provenance problem:

1. Fingerprint the exact recorded file.
2. Sign that fingerprint with a device key.
3. Publish the signed proof hash on a public blockchain.
4. Let anyone verify a local copy without an account, wallet, or app.

This proves the origin and integrity of the file. It does not prove that the scene was not staged or that the camera operator was truthful.

## Solution overview

    Browser capture
        │
        │ video + audio stays local
        ▼
    256 KiB chunks
        │
        ▼
    SHA-256 chunk hashes
        │
        ▼
    Merkle root
        │
        ▼
    Signed canonical payload
        │
        ▼
    Backend verifies signature and anchors its hash
        │
        ▼
    Public verification page

The public proof contains metadata, hashes, a signature, and a blockchain transaction reference. It never contains the video itself.

## Features I implemented

- Browser video and audio capture using getUserMedia and MediaRecorder.
- Fixed 256 KiB file chunking.
- SHA-256 hashing for every chunk.
- Deterministic Merkle tree construction.
- Non-exportable ECDSA P-256 device key generated with Web Crypto.
- IndexedDB storage for the browser CryptoKey.
- Canonical payload encoding with a fixed field order.
- District-only public location information.
- Salted commitment for exact latitude and longitude.
- Backend signature verification before anchoring.
- Solidity contract that records the proof hash and blockchain timestamp.
- Backend-paid EVM transactions, so the witness does not need a wallet.
- Shareable verification pages at /verify/<proofId>.
- Direct public-RPC transaction verification in the browser.
- Original, Edited, and Invalid proof results.
- Different chunk numbers shown for edited files.
- Automated tests for hashing, Merkle roots, signatures, coordinates, and contract compilation.

## Cryptographic design

### Video fingerprint

I split the file into 256 KiB chunks and calculate:

    chunkHash[i] = SHA-256(chunk[i])

The chunk hashes are combined into a Merkle tree. The final Merkle root is the fingerprint of the complete file.

If one byte changes, the affected chunk hash changes, then its parent hash changes, and finally the Merkle root changes.

### Device signature

On first use, the browser generates an ECDSA P-256 key pair:

    private key → signs the payload
    public key  → verifies the signature

The private key is created as non-extractable and stored as a CryptoKey in IndexedDB. The application can ask the browser to sign data, but it never receives the private key bytes.

The public key is the only device identity in the proof. No login, name, phone number, or account is required.

### Canonical payload

I sign a fixed JSON representation containing:

    version
    proofId
    merkleRoot
    chunkHashes
    chunkSize
    fileSize
    capturedAt
    district
    locationCommitment
    devicePublicKey

The field order is explicitly reconstructed before signing. This prevents a valid signature from failing only because two JSON objects used different key orders.

### Location privacy

I publish only the district. The exact coordinates are converted into:

    SHA-256(latitude|longitude|salt)

Latitude and longitude are normalized to six decimal places. The salt is randomly generated and downloaded privately to the witness. The coordinates and salt are never sent to the backend.

## Blockchain anchoring

The backend calculates:

    signedPayloadHash = SHA-256(canonical signed payload)

It calls the Solidity contract with that hash. The contract stores the blockchain timestamp and emits an event containing:

    trueframe:v1:<signedPayloadHash>

The backend wallet pays the testnet gas. Its private key is read only from an environment variable and is never included in the frontend bundle or repository.

The verification page uses a public RPC endpoint to read the transaction receipt independently. It checks the transaction status, contract address, event hash, and event prefix.

## Verification behavior

When a verifier selects a video, the browser hashes it locally and performs four checks:

1. The payload signature matches the published device public key.
2. The blockchain event matches the signed payload hash.
3. The selected file has the expected size and chunk hashes.
4. The selected file produces the signed Merkle root.

The result is interpreted as follows:

| Result | Meaning |
| --- | --- |
| Original | The signature, blockchain anchor, file size, chunk hashes, and Merkle root all match. |
| Edited | The proof is valid, but the selected file differs. The UI lists changed chunks. |
| Invalid proof | The signature, blockchain transaction, contract, or event does not match the proof. |

## Attack cases handled by the implementation

### Changing one byte in the video

The changed chunk receives a different SHA-256 hash. The Merkle root no longer matches, so the result is Edited and the affected chunk is displayed.

### Editing stored proof metadata

Changing the district, file size, Merkle root, or another signed field causes P-256 signature verification to fail. The result is Invalid proof.

### Re-signing with another key

An attacker may produce a mathematically valid signature with another key, but the resulting signed payload hash will not match the original blockchain anchor.

### Pointing a proof to another transaction

The verifier checks that the transaction event contains this proof's exact signed payload hash. A different transaction fails that check.

### Uploading the video

The API receives JSON containing the payload and signature. It does not receive multipart data or the video file. The Network tab can be used to confirm this behavior.

## Local reproducibility

I used Node.js 20 or newer and pnpm.

To reproduce the local project:

    pnpm install
    pnpm build
    pnpm test
    pnpm start

The application is then available at:

    http://localhost:8787

Without blockchain credentials, the project runs in an explicitly labelled LOCAL DEMO mode. This mode creates a deterministic mock anchor for development and does not claim that a public blockchain timestamp exists.

The test suite currently verifies:

- canonical payload field ordering,
- Merkle root changes,
- deterministic chunk hashing,
- P-256 signature verification,
- rejection of modified signed data,
- six-decimal coordinate formatting,
- Solidity contract compilation,
- presence of the ProofAnchored event.

## Sepolia deployment

The code is prepared for real Ethereum Sepolia anchoring. For a testnet deployment, I would provide these values through the hosting platform's secret environment settings:

    RPC_URL
    PUBLIC_RPC_URL
    PRIVATE_KEY
    CONTRACT_ADDRESS
    BLOCK_EXPLORER_BASE

The contract deployment command is:

    pnpm deploy:contract

The deploy script compiles and deploys contracts/TrueFrameAnchor.sol, then prints the address to place in CONTRACT_ADDRESS.

I intentionally do not commit a wallet private key. The private key must belong to a testnet-only account and must be entered only into a secure deployment environment.

## Project structure

    index.html                    browser entry point
    src/main.js                   capture and verification UI
    src/crypto.js                 keys, signatures, and location commitments
    src/api.js                    frontend API requests
    shared/protocol.mjs           protocol constants and canonical encoding
    shared/merkle.mjs             chunk hashing and Merkle tree
    server/index.js               Express API and proof storage
    server/anchor.js              EVM anchoring and local mock mode
    contracts/TrueFrameAnchor.sol blockchain contract
    scripts/deploy-contract.mjs   contract deployment script
    test/                         automated tests
    docs/                         protocol and demonstration notes

Additional design, security, evaluation, and code walkthrough documents are included in this repository.

## Design choices

I selected a browser implementation because it supports camera capture and gives a verifier a zero-install web page. I selected P-256 because it is widely supported by Web Crypto and mobile secure-key systems. I used Merkle trees instead of only a whole-file hash so the verifier can identify changed chunks. I used a backend fee payer so witnesses do not need wallets. I used a small event-emitting contract so the blockchain stores only the minimum required anchor.

The full dated design reasoning is available in DESIGN.md.

## Limitations

- The current prototype stores proof metadata in data/proofs.json. A production service should use a transactional database.
- Local mode uses a mock anchor until real testnet environment variables are configured.
- The current implementation covers the core challenge and does not include optional bonus features such as Not Before time, Merkle batching, perceptual hashes, PDF certificates, or hardware attestation.
- Browser device keys are non-exportable through this application, but a compromised browser profile may still use the key while it remains available.

## References

- TrueFrame challenge: https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/TrueFrame.md
- MDN SubtleCrypto: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- Ethereum Sepolia: https://ethereum.org/en/developers/docs/networks/#sepolia
- Solidity documentation: https://docs.soliditylang.org/
- C2PA specifications: https://c2pa.org/specifications/specifications/2.1/index.html
