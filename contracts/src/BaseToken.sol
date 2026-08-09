// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title BaseToken
/// @notice An immutable-supply ERC-20 with no privileged roles or post-deployment mint path.
/// @dev The complete supply is minted once during construction. This contract deliberately
///      contains no ownership, pausing, fee, blacklist, upgrade, or recovery functionality.
contract BaseToken is ERC20 {
    error ZeroInitialRecipient();
    error ZeroInitialSupply();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address initialRecipient_
    ) ERC20(name_, symbol_) {
        if (initialRecipient_ == address(0)) revert ZeroInitialRecipient();
        if (initialSupply_ == 0) revert ZeroInitialSupply();

        _mint(initialRecipient_, initialSupply_);
    }
}
