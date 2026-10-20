import { bytesToHex } from "./protocol.mjs";

export async function sha256(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export async function hashHex(input) {
  return bytesToHex(await sha256(input));
}

// Duplicate the final node when a level has an odd number of nodes.
export async function merkleRoot(chunkHashes) {
  if (!chunkHashes.length) return hashHex(new Uint8Array());
  let level = chunkHashes.map((hex) => hexToBytes(hex));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      const pair = new Uint8Array(left.length + right.length);
      pair.set(left);
      pair.set(right, left.length);
      next.push(await sha256(pair));
    }
    level = next;
  }
  return bytesToHex(level[0]);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function hashFileInChunks(file, chunkSize) {
  const chunkHashes = [];
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const chunk = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
    chunkHashes.push(bytesToHex(await sha256(chunk)));
  }
  const root = await merkleRoot(chunkHashes);
  return { chunkHashes, merkleRoot: root };
}
