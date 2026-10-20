export async function createProof(body) {
  const response = await fetch("/api/proofs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The proof could not be created");
  return result;
}

export async function getProof(proofId) {
  const response = await fetch("/api/proofs/" + encodeURIComponent(proofId));
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Proof not found");
  return result;
}

export async function getChainConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Unable to load chain configuration");
  return response.json();
}
