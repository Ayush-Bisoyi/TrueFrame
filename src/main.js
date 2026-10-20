import "./styles.css";
import { CHUNK_SIZE, PROTOCOL_VERSION, bytesToHex, normaliseCoordinate } from "../shared/protocol.mjs";
import { hashFileInChunks } from "../shared/merkle.mjs";
import { createSealedLocation, downloadLocationSalt, getOrCreateDeviceKey, signPayload, verifyPayloadSignature } from "./crypto.js";
import { createProof, getChainConfig, getProof } from "./api.js";
import { ethers } from "ethers";

const app = document.querySelector("#app");
const route = window.location.pathname;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function layout(content) {
  return `<header class="topbar"><a class="brand" href="/">TRUE<span>FRAME</span></a><nav><a href="/">Capture</a><a href="/verify/demo">Verify</a><a href="https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/TrueFrame.md" target="_blank" rel="noreferrer">Challenge ↗</a></nav></header><main>${content}</main><footer><span>Proof, not a guess.</span><span>Video stays in your browser.</span></footer>`;
}

function statusBox() {
  return '<div id="status" class="status" role="status"></div>';
}

async function renderCapture() {
  app.innerHTML = layout(`
    <section class="hero"><div class="eyebrow">CAMERA PROVENANCE / V1</div><h1>Make reality<br><em>verifiable.</em></h1><p class="lede">TrueFrame signs the exact video your camera records, seals a private location commitment, and anchors the proof on a public testnet.</p><div class="hero-pills"><span>NO UPLOAD</span><span>NO ACCOUNT</span><span>P-256 + SHA-256</span></div></section>
    <section class="capture-grid">
      <div class="panel"><div class="panel-heading"><span class="step">01</span><div><h2>Record your clip</h2><p>Audio and video are captured locally.</p></div></div>
        <div class="camera-stage"><video id="camera-preview" autoplay muted playsinline></video><div id="camera-placeholder" class="camera-placeholder"><span class="camera-icon">◉</span><span>Camera preview appears here</span></div><div id="recording-indicator" class="recording-indicator hidden"><i></i> RECORDING <b id="recording-time">00:00</b></div></div>
        <div class="control-row"><button id="start-camera" class="button secondary">Enable camera</button><button id="record-button" class="button primary" disabled>Start recording</button><button id="stop-button" class="button danger" disabled>Stop</button></div><div id="recording-summary" class="mini-note"></div>
      </div>
      <div class="panel"><div class="panel-heading"><span class="step">02</span><div><h2>Seal the context</h2><p>Only the district is public; coordinates stay sealed.</p></div></div>
        <form id="proof-form"><label>District <input id="district" required maxlength="120" placeholder="e.g. Surathkal, Karnataka" /></label><div class="two-col"><label>Latitude <input id="latitude" inputmode="decimal" placeholder="12.991600" required /></label><label>Longitude <input id="longitude" inputmode="decimal" placeholder="74.792900" required /></label></div><div class="control-row compact"><button type="button" id="location-button" class="button secondary">Use my location</button><button type="button" id="salt-button" class="button secondary" disabled>Download private salt</button></div><div id="location-summary" class="sealed-note">No location commitment created yet.</div><button class="button primary wide" id="anchor-button" type="submit" disabled>Sign &amp; anchor proof <span>→</span></button></form>
        ${statusBox()}
      </div>
    </section>
    <section class="explain-strip"><div><strong>01 / Fingerprint</strong><span>256 KiB chunks → SHA-256 → Merkle root</span></div><div><strong>02 / Sign</strong><span>Non-exportable P-256 device key</span></div><div><strong>03 / Anchor</strong><span>Only the signed hash reaches the chain</span></div></section>
  `);

  let mediaStream;
  let mediaRecorder;
  let recordingParts = [];
  let recordedFile;
  let recordingStartedAt;
  let timer;
  let sealedLocation;
  const preview = document.querySelector("#camera-preview");
  const placeholder = document.querySelector("#camera-placeholder");
  const startCameraButton = document.querySelector("#start-camera");
  const recordButton = document.querySelector("#record-button");
  const stopButton = document.querySelector("#stop-button");
  const anchorButton = document.querySelector("#anchor-button");
  const status = document.querySelector("#status");
  const saltButton = document.querySelector("#salt-button");

  try {
    const record = await getOrCreateDeviceKey();
    const keyHint = bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(record.publicJwk)))).slice(0, 16);
    document.querySelector("#recording-summary").textContent = "Device key ready · fingerprint " + keyHint + "…";
  } catch (error) {
    setStatus(error.message, "error");
  }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "status " + type;
  }

  startCameraButton.addEventListener("click", async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      preview.srcObject = mediaStream;
      placeholder.classList.add("hidden");
      recordButton.disabled = false;
      startCameraButton.textContent = "Camera enabled";
      startCameraButton.disabled = true;
    } catch (error) {
      setStatus("Camera permission failed: " + error.message, "error");
    }
  });

  recordButton.addEventListener("click", () => {
    recordingParts = [];
    const preferredType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    mediaRecorder = new MediaRecorder(mediaStream, preferredType ? { mimeType: preferredType } : undefined);
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordingParts.push(event.data); };
    mediaRecorder.onstop = async () => {
      recordedFile = new File(recordingParts, "trueframe-capture.webm", { type: mediaRecorder.mimeType || "video/webm" });
      preview.srcObject = null;
      preview.src = URL.createObjectURL(recordedFile);
      preview.controls = true;
      anchorButton.disabled = false;
      document.querySelector("#recording-summary").textContent = "Ready · " + (recordedFile.size / 1024).toFixed(1) + " KiB · video never leaves this page";
      setStatus("Clip fingerprint can now be signed.", "success");
    };
    mediaRecorder.start(1000);
    recordingStartedAt = Date.now();
    recordButton.disabled = true;
    stopButton.disabled = false;
    document.querySelector("#recording-indicator").classList.remove("hidden");
    timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
      document.querySelector("#recording-time").textContent = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    }, 250);
  });

  stopButton.addEventListener("click", () => {
    if (!mediaRecorder) return;
    mediaRecorder.stop();
    clearInterval(timer);
    stopButton.disabled = true;
    document.querySelector("#recording-indicator").classList.add("hidden");
  });

  document.querySelector("#location-button").addEventListener("click", () => {
    if (!navigator.geolocation) return setStatus("Geolocation is not available in this browser.", "error");
    setStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.querySelector("#latitude").value = position.coords.latitude.toFixed(6);
        document.querySelector("#longitude").value = position.coords.longitude.toFixed(6);
        setStatus("Coordinates filled locally. Create the sealed commitment before anchoring.", "success");
      },
      (error) => setStatus("Location was not read: " + error.message, "error"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  });

  async function refreshLocationCommitment() {
    const lat = document.querySelector("#latitude").value.trim();
    const lon = document.querySelector("#longitude").value.trim();
    if (!lat || !lon) return;
    try {
      normaliseCoordinate(lat);
      normaliseCoordinate(lon);
      sealedLocation = await createSealedLocation(lat, lon);
      document.querySelector("#location-summary").innerHTML = "Sealed commitment <code>" + sealedLocation.commitment.slice(0, 20) + "…</code><br><small>Exact coordinates and salt are not part of the public proof.</small>";
      saltButton.disabled = false;
    } catch (error) {
      setStatus(error.message, "error");
    }
  }
  document.querySelector("#latitude").addEventListener("change", refreshLocationCommitment);
  document.querySelector("#longitude").addEventListener("change", refreshLocationCommitment);
  saltButton.addEventListener("click", () => sealedLocation && downloadLocationSalt(sealedLocation));

  document.querySelector("#proof-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!recordedFile) return setStatus("Record a clip first.", "error");
    if (!sealedLocation) await refreshLocationCommitment();
    if (!sealedLocation) return setStatus("Provide valid coordinates to create the sealed location commitment.", "error");
    anchorButton.disabled = true;
    anchorButton.innerHTML = "Hashing locally…";
    try {
      const fingerprint = await hashFileInChunks(recordedFile, CHUNK_SIZE);
      const payload = {
        version: PROTOCOL_VERSION,
        proofId: crypto.randomUUID(),
        merkleRoot: fingerprint.merkleRoot,
        chunkHashes: fingerprint.chunkHashes,
        chunkSize: CHUNK_SIZE,
        fileSize: recordedFile.size,
        capturedAt: new Date().toISOString(),
        district: document.querySelector("#district").value.trim(),
        locationCommitment: sealedLocation.commitment,
        devicePublicKey: (await getOrCreateDeviceKey()).publicJwk
      };
      const { signature } = await signPayload(payload);
      anchorButton.innerHTML = "Anchoring signed hash…";
      const proof = await createProof({ payload, signature });
      window.location.href = "/verify/" + encodeURIComponent(proof.proofId);
    } catch (error) {
      setStatus(error.message, "error");
      anchorButton.disabled = false;
      anchorButton.innerHTML = "Sign &amp; anchor proof <span>→</span>";
    }
  });
}

function checkList(checks) {
  return `<div class="checks">${checks.map((check) => `<div class="check ${check.ok ? "pass" : "fail"}"><span>${check.ok ? "✓" : "×"}</span><div><strong>${escapeHtml(check.name)}</strong><small>${escapeHtml(check.detail)}</small></div></div>`).join("")}</div>`;
}

async function verifyOnChain(proof, config) {
  if (proof.anchor.mode === "mock") return { ok: proof.anchor.transactionHash.startsWith("0x"), detail: "Local mock anchor (no RPC configured)" };
  if (!config.rpcUrl || !config.contractAddress) return { ok: false, detail: "Public RPC or contract address is missing" };
  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const receipt = await provider.getTransactionReceipt(proof.anchor.transactionHash);
    if (!receipt || receipt.status !== 1) return { ok: false, detail: "Transaction is missing or reverted" };
    if (receipt.to?.toLowerCase() !== config.contractAddress.toLowerCase()) return { ok: false, detail: "Transaction targets another contract" };
    const iface = new ethers.Interface(["event ProofAnchored(bytes32 indexed payloadHash, string memo, uint256 anchoredAtBlockTime)"]);
    const match = receipt.logs.map((log) => { try { return iface.parseLog({ topics: log.topics, data: log.data }); } catch { return null; } }).find((parsed) => parsed?.name === "ProofAnchored");
    const payloadHash = "0x" + proof.signedPayloadHash;
    const ok = match && String(match.args.payloadHash).toLowerCase() === payloadHash.toLowerCase() && String(match.args.memo) === "trueframe:v1:" + proof.signedPayloadHash;
    return { ok: Boolean(ok), detail: ok ? "Event matches the signed payload hash" : "Anchor event does not match this proof" };
  } catch (error) {
    return { ok: false, detail: "RPC verification failed: " + error.message };
  }
}

async function renderVerify(proofId) {
  app.innerHTML = layout(`<section class="verify-hero"><div class="eyebrow">PUBLIC VERIFICATION / ${escapeHtml(proofId.slice(0, 8))}</div><h1>Can this clip<br><em>stand up?</em></h1><p class="lede">Drop in any copy of the file. Everything is checked locally in your browser.</p></section><section id="verify-panel" class="verify-layout"><div class="panel loading">Loading proof…</div></section>`);
  const panel = document.querySelector("#verify-panel");
  try {
    const proof = await getProof(proofId);
    const config = await getChainConfig();
    const date = new Date(proof.payload.capturedAt).toLocaleString();
    panel.innerHTML = `<div class="panel proof-card"><div class="proof-state"><span class="state-dot"></span><span>PROOF FOUND</span><span class="anchor-mode">${escapeHtml(proof.anchor.mode === "evm" ? proof.anchor.chain : "LOCAL DEMO")}</span></div><h2>${escapeHtml(proof.payload.district)}</h2><div class="metadata"><div><small>RECORDED</small><strong>${escapeHtml(date)}</strong></div><div><small>DEVICE KEY</small><strong>${escapeHtml(proof.payload.devicePublicKey.x.slice(0, 12))}…</strong></div><div><small>FINGERPRINT</small><strong>${escapeHtml(proof.payload.merkleRoot.slice(0, 16))}…</strong></div></div>${proof.anchor.blockExplorerUrl ? `<a class="explorer-link" href="${escapeHtml(proof.anchor.blockExplorerUrl)}" target="_blank" rel="noreferrer">View anchor transaction ↗</a>` : `<span class="explorer-link muted">Configure Sepolia to get a block explorer link</span>`}</div><div class="panel drop-card"><div class="panel-heading"><span class="step">CHECK</span><div><h2>Verify a copy</h2><p>Hashing happens in this browser. The video is never uploaded.</p></div></div><label class="file-drop" for="video-file"><input id="video-file" type="file" accept="video/*" /><span class="upload-mark">↑</span><strong>Choose the video file</strong><small>Any local copy of the alleged original</small></label><div id="verify-status"></div></div><aside class="panel not-prove"><strong>What this does not prove</strong><p>TrueFrame proves that this device signed this exact file by this time. It does not prove that the scene was not staged or that the camera operator was truthful.</p></aside>`;
    document.querySelector("#video-file").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const output = document.querySelector("#verify-status");
      output.innerHTML = `<div class="progress">Hashing ${escapeHtml(file.name)} locally…</div>`;
      try {
        const fingerprint = await hashFileInChunks(file, proof.payload.chunkSize);
        const signatureOk = await verifyPayloadSignature(proof.payload, proof.signature);
        const anchorCheck = await verifyOnChain(proof, config);
        const fileSizeOk = file.size === proof.payload.fileSize;
        const chunkCount = Math.max(fingerprint.chunkHashes.length, proof.payload.chunkHashes.length);
        const differingChunks = [];
        for (let index = 0; index < chunkCount; index += 1) if (fingerprint.chunkHashes[index] !== proof.payload.chunkHashes[index]) differingChunks.push(index + 1);
        const rootOk = fingerprint.merkleRoot === proof.payload.merkleRoot;
        const original = signatureOk && anchorCheck.ok && fileSizeOk && rootOk && differingChunks.length === 0;
        const invalid = !signatureOk || !anchorCheck.ok;
        const resultClass = original ? "original" : invalid ? "invalid" : "edited";
        const headline = original ? "Original" : invalid ? "Invalid proof" : "Edited";
        const details = original ? "Every chunk matches the signed Merkle root." : invalid ? (!signatureOk ? "The payload signature does not match the device key." : anchorCheck.detail) : "The proof is valid, but this file is not byte-for-byte identical.";
        output.innerHTML = `<div class="result ${resultClass}"><div class="result-head"><span class="result-icon">${original ? "✓" : invalid ? "×" : "!"}</span><div><h2>${headline}</h2><p>${escapeHtml(details)}</p></div></div>${checkList([{ name: "P-256 signature", ok: signatureOk, detail: signatureOk ? "Payload was signed by the published device key" : "Signature check failed" }, { name: "Blockchain anchor", ok: anchorCheck.ok, detail: anchorCheck.detail }, { name: "Merkle root", ok: rootOk, detail: rootOk ? "All chunk hashes produce the signed root" : "At least one chunk hash changed" }, { name: "File size", ok: fileSizeOk, detail: fileSizeOk ? file.size + " bytes" : "Expected " + proof.payload.fileSize + " bytes, got " + file.size }])}${differingChunks.length && !invalid ? `<div class="differences"><strong>Different chunks:</strong> ${differingChunks.slice(0, 30).join(", ")}${differingChunks.length > 30 ? " … +" + (differingChunks.length - 30) + " more" : ""}</div>` : ""}</div>`;
      } catch (error) {
        output.innerHTML = `<div class="status error">${escapeHtml(error.message)}</div>`;
      }
    });
  } catch (error) {
    panel.innerHTML = `<div class="panel status error">${escapeHtml(error.message)}</div>`;
  }
}

if (route.startsWith("/verify/") && route.split("/").filter(Boolean)[1]) renderVerify(decodeURIComponent(route.split("/").filter(Boolean)[1]));
else renderCapture();
