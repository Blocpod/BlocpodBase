// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { VestingWallet } from "@openzeppelin/contracts/finance/VestingWallet.sol";

/// @title BlocpodVestingWalletV1
/// @notice A non-revocable linear vesting wallet with an immutable beneficiary.
/// @dev Assets are funded after deployment. Anyone may trigger release, but vested assets are always
///      paid to the beneficiary. Ownership transfer and renunciation are permanently disabled.
contract BlocpodVestingWalletV1 is VestingWallet {
    error BeneficiaryIsImmutable();

    constructor(address beneficiary_, uint64 startTimestamp_, uint64 durationSeconds_)
        VestingWallet(beneficiary_, startTimestamp_, durationSeconds_)
    { }

    function transferOwnership(address) public pure override {
        revert BeneficiaryIsImmutable();
    }

    function renounceOwnership() public pure override {
        revert BeneficiaryIsImmutable();
    }
}
