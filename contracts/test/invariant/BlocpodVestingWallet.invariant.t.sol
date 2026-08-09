// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { BaseToken } from "../../src/BaseToken.sol";
import { BlocpodVestingWalletV1 } from "../../src/BlocpodVestingWalletV1.sol";

contract VestingHandler is Test {
    BaseToken public immutable token;
    BlocpodVestingWalletV1 public immutable wallet;
    uint256 private immutable end;

    constructor(BaseToken token_, BlocpodVestingWalletV1 wallet_) {
        token = token_;
        wallet = wallet_;
        end = wallet_.start() + wallet_.duration() + 365 days;
    }

    function warpAndRelease(uint256 timestamp) external {
        if (block.timestamp < end) {
            vm.warp(bound(timestamp, block.timestamp, end));
        }
        wallet.release(address(token));
    }
}

contract BlocpodVestingWalletInvariantTest is StdInvariant, Test {
    uint256 private constant ALLOCATION = 1_000_000 ether;

    address private beneficiary;
    BaseToken private token;
    BlocpodVestingWalletV1 private wallet;
    VestingHandler private handler;

    function setUp() external {
        beneficiary = makeAddr("beneficiary");
        wallet = new BlocpodVestingWalletV1(beneficiary, 10_000, 365 days);
        token = new BaseToken("Vested", "VEST", ALLOCATION, address(wallet));
        handler = new VestingHandler(token, wallet);
        targetContract(address(handler));
    }

    function invariant_AllocationCanOnlyMoveToBeneficiary() external view {
        assertEq(token.balanceOf(address(wallet)) + token.balanceOf(beneficiary), ALLOCATION);
    }

    function invariant_BeneficiaryNeverChanges() external view {
        assertEq(wallet.owner(), beneficiary);
    }

    function invariant_ReleasedNeverExceedsAllocation() external view {
        assertLe(wallet.released(address(token)), ALLOCATION);
    }
}
