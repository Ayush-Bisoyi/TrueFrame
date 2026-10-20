# Demonstration script

Use this script for the screen recording required by the recruitment submission.

## Part 1: capture

1. Start the server and open the home page.
2. Explain that the device key is generated once in IndexedDB and that the private key is non-exportable.
3. Click Enable camera and record 10–15 seconds with audio.
4. Stop recording and point out the file size. Explain that the video remains in the browser.
5. Enter the district and coordinates. Use Download private salt and explain that the salt is given only to the witness.
6. Open browser developer tools on the Network tab. Click Sign & anchor proof. Show that the request contains JSON proof metadata and no video bytes.

## Part 2: original verification

1. Show the redirect to /verify/<proofId>.
2. Select the original WebM file.
3. Explain the four checks: P-256 signature, chain anchor, Merkle root, and file size.
4. Show the Original result.

## Part 3: edited verification

1. Make a copy of the WebM file.
2. Modify or re-encode the copy.
3. Select it on the same verification page.
4. Show Edited and the list of different chunk numbers.

## Part 4: invalid proof

For a local demonstration only, stop the server, edit one field in data/proofs.json, restart the server, and reload the proof. The result should be Invalid proof because the stored payload no longer matches the signature. Restore the file after recording.

## Part 5: real chain

In Sepolia mode, open the transaction link shown on the proof page and show the ProofAnchored event containing the trueframe:v1: prefix. State clearly which metadata is public and that the video itself is not on-chain.
