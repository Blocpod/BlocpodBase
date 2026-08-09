// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { BaseToken } from "../src/BaseToken.sol";
import { BaseTokenFactoryV1 } from "../src/BaseTokenFactoryV1.sol";

contract BaseTokenFactoryV1Test is Test {
    event TokenDeployed(
        address indexed creator,
        address indexed token,
        bytes32 indexed deploymentSalt,
        address initialRecipient,
        string name,
        string symbol,
        uint256 initialSupply,
        bytes32 userSalt
    );

    BaseTokenFactoryV1 private factory;
    address private creator = makeAddr("creator");
    address private recipient = makeAddr("recipient");
    bytes32 private constant USER_SALT = keccak256("blocpod-v1");

    function setUp() external {
        factory = new BaseTokenFactoryV1();
    }

    function test_DeploysToPredictedAddressAndRecordsProvenance() external {
        address predicted = factory.predictTokenAddress(
            creator, "Blocpod", "BLOC", 1_000_000 ether, recipient, USER_SALT
        );
        bytes32 deploymentSalt = factory.computeDeploymentSalt(creator, USER_SALT);

        vm.expectEmit(true, true, true, true, address(factory));
        emit TokenDeployed(
            creator,
            predicted,
            deploymentSalt,
            recipient,
            "Blocpod",
            "BLOC",
            1_000_000 ether,
            USER_SALT
        );
        vm.prank(creator);
        address deployed =
            factory.deployToken("Blocpod", "BLOC", 1_000_000 ether, recipient, USER_SALT);

        assertEq(deployed, predicted);
        assertEq(factory.deploymentOf(creator, USER_SALT), deployed);
        assertEq(BaseToken(deployed).balanceOf(recipient), 1_000_000 ether);
        assertEq(BaseToken(deployed).totalSupply(), 1_000_000 ether);
    }

    function test_RevertWhenCreatorReusesSaltEvenWithDifferentParameters() external {
        vm.prank(creator);
        address deployed = factory.deployToken("First", "ONE", 1 ether, recipient, USER_SALT);

        vm.expectRevert(
            abi.encodeWithSelector(
                BaseTokenFactoryV1.SaltAlreadyUsed.selector, creator, USER_SALT, deployed
            )
        );
        vm.prank(creator);
        factory.deployToken("Second", "TWO", 2 ether, recipient, USER_SALT);
    }

    function test_SameUserSaltIsIsolatedAcrossCreators() external {
        address secondCreator = makeAddr("secondCreator");

        vm.prank(creator);
        address first = factory.deployToken("First", "ONE", 1 ether, recipient, USER_SALT);
        vm.prank(secondCreator);
        address second = factory.deployToken("First", "ONE", 1 ether, recipient, USER_SALT);

        assertTrue(first != second);
        assertEq(factory.deploymentOf(creator, USER_SALT), first);
        assertEq(factory.deploymentOf(secondCreator, USER_SALT), second);
    }

    function test_DeploymentLeavesFactoryWithNoTokenBalanceOrAuthority() external {
        vm.prank(creator);
        address deployed = factory.deployToken("Blocpod", "BLOC", 100 ether, recipient, USER_SALT);

        assertEq(BaseToken(deployed).balanceOf(address(factory)), 0);
        assertEq(BaseToken(deployed).allowance(recipient, address(factory)), 0);
    }

    function test_RevertWhenNameIsEmpty() external {
        vm.expectRevert(BaseTokenFactoryV1.EmptyName.selector);
        factory.deployToken("", "BLOC", 1, recipient, USER_SALT);
    }

    function test_RevertWhenSymbolIsEmpty() external {
        vm.expectRevert(BaseTokenFactoryV1.EmptySymbol.selector);
        factory.deployToken("Blocpod", "", 1, recipient, USER_SALT);
    }

    function test_AcceptsMaximumNameAndSymbolByteLengths() external {
        string memory name = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        string memory symbol = "ABCDEFGHIJKL";

        vm.prank(creator);
        address deployed = factory.deployToken(name, symbol, 1, recipient, USER_SALT);

        assertEq(BaseToken(deployed).name(), name);
        assertEq(BaseToken(deployed).symbol(), symbol);
    }

    function test_RevertWhenNameExceedsUtf8ByteLimit() external {
        // 22 EURO SIGN code points encode to 66 UTF-8 bytes, despite being only 22 characters.
        string memory name =
            unicode"€€€€€€€€€€€€€€€€€€€€€€";

        vm.expectRevert(abi.encodeWithSelector(BaseTokenFactoryV1.NameTooLong.selector, 66, 64));
        factory.deployToken(name, "BLOC", 1, recipient, USER_SALT);
    }

    function test_RevertWhenSymbolExceedsUtf8ByteLimit() external {
        // Five EURO SIGN code points encode to 15 UTF-8 bytes.
        string memory symbol = unicode"€€€€€";

        vm.expectRevert(abi.encodeWithSelector(BaseTokenFactoryV1.SymbolTooLong.selector, 15, 12));
        factory.deployToken("Blocpod", symbol, 1, recipient, USER_SALT);
    }

    function test_PredictionAppliesTheSameNameByteLimitAsDeployment() external {
        string memory name = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

        vm.expectRevert(abi.encodeWithSelector(BaseTokenFactoryV1.NameTooLong.selector, 65, 64));
        factory.predictTokenAddress(creator, name, "BLOC", 1, recipient, USER_SALT);
    }

    function test_PredictionAppliesTheSameSymbolByteLimitAsDeployment() external {
        string memory symbol = "ABCDEFGHIJKLM";

        vm.expectRevert(abi.encodeWithSelector(BaseTokenFactoryV1.SymbolTooLong.selector, 13, 12));
        factory.predictTokenAddress(creator, "Blocpod", symbol, 1, recipient, USER_SALT);
    }

    function test_RevertWhenRecipientIsZero() external {
        vm.expectRevert(BaseTokenFactoryV1.ZeroInitialRecipient.selector);
        factory.deployToken("Blocpod", "BLOC", 1, address(0), USER_SALT);
    }

    function test_RevertWhenSupplyIsZero() external {
        vm.expectRevert(BaseTokenFactoryV1.ZeroInitialSupply.selector);
        factory.deployToken("Blocpod", "BLOC", 0, recipient, USER_SALT);
    }

    function testFuzz_PredictionEqualsDeployment(
        address fuzzCreator,
        address fuzzRecipient,
        uint256 supply,
        bytes32 userSalt
    ) external {
        vm.assume(fuzzCreator != address(0));
        vm.assume(fuzzRecipient != address(0));
        vm.assume(supply != 0);

        address predicted = factory.predictTokenAddress(
            fuzzCreator, "Fuzz Token", "FUZZ", supply, fuzzRecipient, userSalt
        );
        vm.prank(fuzzCreator);
        address deployed =
            factory.deployToken("Fuzz Token", "FUZZ", supply, fuzzRecipient, userSalt);

        assertEq(deployed, predicted);
    }
}
