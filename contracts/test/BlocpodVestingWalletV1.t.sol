// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { BaseToken } from "../src/BaseToken.sol";
import { BlocpodVestingWalletV1 } from "../src/BlocpodVestingWalletV1.sol";

contract BlocpodVestingWalletV1Test is Test {
    address private beneficiary = makeAddr("beneficiary");
    address private treasury = makeAddr("treasury");

    function test_ReleasesLinearlyAndCannotRevokeUnvestedTokens() external {
        uint64 start = 1_000;
        uint64 duration = 1_000;
        BlocpodVestingWalletV1 wallet = new BlocpodVestingWalletV1(beneficiary, start, duration);
        BaseToken token = new BaseToken("Blocpod", "BLOC", 100 ether, treasury);
        vm.prank(treasury);
        assertTrue(token.transfer(address(wallet), 100 ether));

        vm.warp(1_500);
        wallet.release(address(token));
        assertEq(token.balanceOf(beneficiary), 50 ether);
        assertEq(token.balanceOf(address(wallet)), 50 ether);

        vm.warp(2_000);
        wallet.release(address(token));
        assertEq(token.balanceOf(beneficiary), 100 ether);
        assertEq(token.balanceOf(address(wallet)), 0);
    }

    function test_BeneficiaryCannotBeChangedOrRenounced() external {
        BlocpodVestingWalletV1 wallet = new BlocpodVestingWalletV1(beneficiary, 1_000, 1_000);

        vm.expectRevert(BlocpodVestingWalletV1.BeneficiaryIsImmutable.selector);
        vm.prank(beneficiary);
        wallet.transferOwnership(makeAddr("replacement"));

        vm.expectRevert(BlocpodVestingWalletV1.BeneficiaryIsImmutable.selector);
        vm.prank(beneficiary);
        wallet.renounceOwnership();

        assertEq(wallet.owner(), beneficiary);
    }

    function testFuzz_VestedAmountNeverExceedsAllocation(uint128 allocation, uint64 elapsed)
        external
    {
        vm.assume(allocation != 0);
        uint64 start = 10_000;
        uint64 duration = 365 days;
        BlocpodVestingWalletV1 wallet = new BlocpodVestingWalletV1(beneficiary, start, duration);
        BaseToken token = new BaseToken("Fuzz", "FUZZ", allocation, address(wallet));

        assertLe(wallet.vestedAmount(address(token), elapsed), allocation);
    }
}
