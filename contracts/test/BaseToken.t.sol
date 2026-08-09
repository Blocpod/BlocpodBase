// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { BaseToken } from "../src/BaseToken.sol";

contract BaseTokenTest is Test {
    address private recipient = makeAddr("recipient");

    function test_ConstructorMintsExactSupplyToRecipient() external {
        BaseToken token = new BaseToken("Blocpod", "BLOC", 1_000_000 ether, recipient);

        assertEq(token.name(), "Blocpod");
        assertEq(token.symbol(), "BLOC");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.balanceOf(recipient), 1_000_000 ether);
        assertEq(token.balanceOf(address(this)), 0);
    }

    function test_TransfersUseStandardERC20Behavior() external {
        BaseToken token = new BaseToken("Blocpod", "BLOC", 100 ether, recipient);
        address holder = makeAddr("holder");

        vm.prank(recipient);
        assertTrue(token.transfer(holder, 40 ether));

        assertEq(token.balanceOf(recipient), 60 ether);
        assertEq(token.balanceOf(holder), 40 ether);
        assertEq(token.totalSupply(), 100 ether);
    }

    function test_RevertWhenInitialRecipientIsZero() external {
        vm.expectRevert(BaseToken.ZeroInitialRecipient.selector);
        new BaseToken("Blocpod", "BLOC", 1, address(0));
    }

    function test_RevertWhenInitialSupplyIsZero() external {
        vm.expectRevert(BaseToken.ZeroInitialSupply.selector);
        new BaseToken("Blocpod", "BLOC", 0, recipient);
    }

    function testFuzz_ConstructorMintsExactSupply(uint256 supply, address fuzzRecipient) external {
        vm.assume(fuzzRecipient != address(0));
        vm.assume(supply != 0);

        BaseToken token = new BaseToken("Fuzz Token", "FUZZ", supply, fuzzRecipient);

        assertEq(token.totalSupply(), supply);
        assertEq(token.balanceOf(fuzzRecipient), supply);
    }
}
