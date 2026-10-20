import crypto from "node:crypto";
import { ethers } from "ethers";

const ABI = [
  "function anchor(bytes32 payloadHash) external",
  "event ProofAnchored(bytes32 indexed payloadHash, string memo, uint256 anchoredAt)"
];

function hexDigest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function anchorProof(payloadHash) {
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const chainName = process.env.CHAIN_NAME || "sepolia";
  const explorerBase = process.env.BLOCK_EXPLORER_BASE || "https://sepolia.etherscan.io";

  if (!rpcUrl || !privateKey || !contractAddress || privateKey.includes("your-testnet")) {
    const mockHash = "0x" + hexDigest("trueframe:mock:" + payloadHash);
    return {
      mode: "mock",
      chain: "local-mock",
      transactionHash: mockHash,
      blockExplorerUrl: null,
      contractAddress: null
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, ABI, wallet);
  const transaction = await contract.anchor("0x" + payloadHash);
  const receipt = await transaction.wait();

  return {
    mode: "evm",
    chain: chainName,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    blockExplorerUrl: explorerBase.replace(/\/$/, "") + "/tx/" + receipt.hash,
    contractAddress,
    rpcUrl: process.env.PUBLIC_RPC_URL || rpcUrl
  };
}

export function publicChainConfig() {
  return {
    chain: process.env.CHAIN_NAME || "local-mock",
    mode: process.env.RPC_URL && process.env.CONTRACT_ADDRESS ? "evm" : "mock",
    rpcUrl: process.env.PUBLIC_RPC_URL || process.env.RPC_URL || null,
    contractAddress: process.env.CONTRACT_ADDRESS || null,
    blockExplorerBase: process.env.BLOCK_EXPLORER_BASE || null
  };
}
