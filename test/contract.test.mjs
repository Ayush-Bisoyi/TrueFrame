import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import solc from "solc";

test("TrueFrameAnchor compiles and exposes the expected event", async () => {
  const source = await fs.readFile(new URL("../contracts/TrueFrameAnchor.sol", import.meta.url), "utf8");
  const input = {
    language: "Solidity",
    sources: { "TrueFrameAnchor.sol": { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  assert.deepEqual(errors, []);
  const contract = output.contracts["TrueFrameAnchor.sol"].TrueFrameAnchor;
  assert.ok(contract.evm.bytecode.object.length > 100);
  assert.ok(contract.abi.some((item) => item.type === "event" && item.name === "ProofAnchored"));
});
