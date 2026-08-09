// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { BaseToken } from "../../src/BaseToken.sol";

contract TransferHandler is Test {
    BaseToken public immutable token;
    address[4] private actors;

    constructor(BaseToken token_, address initialHolder_) {
        token = token_;
        actors = [initialHolder_, makeAddr("actor1"), makeAddr("actor2"), makeAddr("actor3")];
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = actors[fromSeed % actors.length];
        address to = actors[toSeed % actors.length];
        uint256 balance = token.balanceOf(from);
        amount = bound(amount, 0, balance);

        vm.prank(from);
        assertTrue(token.transfer(to, amount));
    }
}

contract BaseTokenInvariantTest is StdInvariant, Test {
    uint256 private constant INITIAL_SUPPLY = 1_000_000 ether;

    BaseToken private token;
    TransferHandler private handler;

    function setUp() external {
        address treasury = makeAddr("treasury");
        token = new BaseToken("Invariant Token", "INV", INITIAL_SUPPLY, treasury);
        handler = new TransferHandler(token, treasury);
        targetContract(address(handler));
    }

    function invariant_TotalSupplyNeverChanges() external view {
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
    }

    function invariant_HandlerCannotCreateSupply() external view {
        assertLe(token.balanceOf(address(handler)), INITIAL_SUPPLY);
    }
}
