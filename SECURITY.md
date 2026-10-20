# Security notes

## Secrets

PRIVATE_KEY is server-only. It pays testnet gas and must never be committed, copied into Vite client variables, or placed in public/. .env is ignored by Git.

PUBLIC_RPC_URL, contract address, chain name, and block explorer URL are not secrets. A browser needs the public RPC URL to perform independent receipt verification.

## Trust boundaries

The browser owns the recording and the device private key. The API receives a JSON payload and a signature, verifies them before anchoring, and stores no video. The chain provides an append-only timestamp anchor, but it does not know whether a scene is truthful.

## Failure behavior

- Changing any signed payload field makes signature verification fail.
- Replacing the device public key makes signature verification fail.
- Pointing a proof at another transaction makes the event/hash check fail.
- Editing a video changes one or more chunk hashes and the Merkle root.
- A missing or reverted RPC receipt is an invalid proof, not an edited file.

## Production hardening still needed

This recruitment prototype uses a JSON file for proof metadata. A production deployment should add an authenticated operator path, database transactions, rate limiting, request schema validation with a library, HTTPS-only cookies if accounts are ever added, key rotation, log redaction, and a durable database. None of those are needed to make the core provenance protocol work locally.
