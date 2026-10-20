import "dotenv/config";
import fs from "node:fs/promises";
import solc from "solc";
import { ethers } from "ethers";

if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
  throw new Error("Set RPC_URL and PRIVATE_KEY in .env before deploying.");
}

const source = await fs.readFile(new URL("../contracts/TrueFrameAnchor.sol", import.meta.url), "utf8");
const input = {
  language: "Solidity",
  sources: { "TrueFrameAnchor.sol": { content: source } },
  settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join("\n"));

const compiled = output.contracts["TrueFrameAnchor.sol"].TrueFrameAnchor;
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const factory = new ethers.ContractFactory(compiled.abi, compiled.evm.bytecode.object, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();
console.log("Deployed TrueFrameAnchor:", await contract.getAddress());
console.log("Set CONTRACT_ADDRESS in .env to this address.");
