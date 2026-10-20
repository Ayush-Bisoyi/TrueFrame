// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal public timestamp anchor for TrueFrame proof hashes.
/// The contract never sees a video or a private key.
contract TrueFrameAnchor {
    mapping(bytes32 => uint256) public anchoredAt;

    event ProofAnchored(
        bytes32 indexed payloadHash,
        string memo,
        uint256 anchoredAtBlockTime
    );

    function anchor(bytes32 payloadHash) external {
        require(anchoredAt[payloadHash] == 0, "already anchored");
        anchoredAt[payloadHash] = block.timestamp;
        emit ProofAnchored(
            payloadHash,
            string.concat("trueframe:v1:", _toHex(payloadHash)),
            block.timestamp
        );
    }

    function _toHex(bytes32 value) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory output = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            output[i * 2] = alphabet[uint8(value[i] >> 4)];
            output[i * 2 + 1] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(output);
    }
}
