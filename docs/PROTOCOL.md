# TrueFrame protocol

This is the protocol a reviewer can implement independently.

## 1. Chunk hashes

Let the captured file be split into consecutive 262,144-byte chunks. For every chunk:

    h[i] = SHA-256(chunk[i])

The final short chunk is still hashed. An empty file is rejected by the API.

## 2. Merkle root

At every tree level, concatenate adjacent 32-byte hashes and hash the result:

    parent = SHA-256(left || right)

When a level has an odd number of nodes, duplicate the final node before hashing it with itself. Continue until one 32-byte value remains. Its lowercase hexadecimal encoding is merkleRoot.

This makes the root sensitive to the order, content, and number of chunks.

## 3. Canonical payload

The exact signed field order is:

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

The fields are serialized as compact JSON in this order. No video bytes are included. The signature is ECDSA P-256 with SHA-256 over the UTF-8 canonical JSON bytes.

## 4. Location commitment

The browser normalizes latitude and longitude to six digits after the decimal point:

    lat = latitude.toFixed(6)
    lon = longitude.toFixed(6)

It generates a random salt and hashes:

    SHA-256(UTF-8(lat + "|" + lon + "|" + salt))

Only the resulting hexadecimal commitment and the district are published. The salt is downloaded locally for the witness.

## 5. Blockchain anchor

The API computes:

    signedPayloadHash = SHA-256(canonicalPayload)

The server wallet calls anchor(bytes32 signedPayloadHash). The contract records block.timestamp and emits:

    trueframe:v1:<signedPayloadHash>

The frontend later reads the transaction receipt directly from the configured public RPC and checks the contract address, receipt status, event payload hash, and event memo.

## 6. Verification decision

The verifier:

1. Reads the proof JSON.
2. Reconstructs the canonical payload and verifies the P-256 signature.
3. Reads and checks the blockchain event.
4. Hashes the selected file locally using the same chunk size.
5. Compares file size, every chunk hash, and the Merkle root.

If steps 2 or 3 fail, the proof is Invalid. If the proof and anchor are valid but the selected file differs, the result is Edited and the changed chunk numbers are shown. Only when every check passes is the result Original.
