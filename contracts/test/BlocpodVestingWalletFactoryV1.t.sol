// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { BlocpodVestingWalletV1 } from "../src/BlocpodVestingWalletV1.sol";
import { BlocpodVestingWalletFactoryV1 } from "../src/BlocpodVestingWalletFactoryV1.sol";

contract BlocpodVestingWalletFactoryV1Test is Test {
    BlocpodVestingWalletFactoryV1 private factory;
    address private creator = makeAddr("creator");
    address private beneficiary = makeAddr("beneficiary");
    bytes32 private constant USER_SALT = keccak256("team-allocation");

    function setUp() external {
        factory = new BlocpodVestingWalletFactoryV1();
    }

    function test_DeploysAtPredictedAddressWithImmutableSchedule() external {
        address predicted =
            factory.predictVestingWalletAddress(creator, beneficiary, 1_000, 365 days, USER_SALT);
        vm.prank(creator);
        address deployed = factory.deployVestingWallet(beneficiary, 1_000, 365 days, USER_SALT);

        BlocpodVestingWalletV1 wallet = BlocpodVestingWalletV1(payable(deployed));
        assertEq(deployed, predicted);
        assertEq(factory.deploymentOf(creator, USER_SALT), deployed);
        assertEq(wallet.owner(), beneficiary);
        assertEq(wallet.start(), 1_000);
        assertEq(wallet.duration(), 365 days);
    }

    function test_RevertWhenSaltIsReused() external {
        vm.prank(creator);
        address deployed = factory.deployVestingWallet(beneficiary, 1_000, 365 days, USER_SALT);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlocpodVestingWalletFactoryV1.SaltAlreadyUsed.selector, creator, USER_SALT, deployed
            )
        );
        vm.prank(creator);
        factory.deployVestingWallet(beneficiary, 2_000, 30 days, USER_SALT);
    }

    function test_RevertOnInvalidInputs() external {
        vm.expectRevert(BlocpodVestingWalletFactoryV1.ZeroBeneficiary.selector);
        factory.deployVestingWallet(address(0), 1_000, 1, USER_SALT);

        vm.expectRevert(BlocpodVestingWalletFactoryV1.ZeroDuration.selector);
        factory.deployVestingWallet(beneficiary, 1_000, 0, USER_SALT);
    }

    function testFuzz_PredictionEqualsDeployment(
        address fuzzCreator,
        address fuzzBeneficiary,
        uint64 start,
        uint64 duration,
        bytes32 userSalt
    ) external {
        vm.assume(fuzzCreator != address(0));
        vm.assume(fuzzBeneficiary != address(0));
        vm.assume(duration != 0);

        address predicted = factory.predictVestingWalletAddress(
            fuzzCreator, fuzzBeneficiary, start, duration, userSalt
        );
        vm.prank(fuzzCreator);
        address deployed = factory.deployVestingWallet(fuzzBeneficiary, start, duration, userSalt);
        assertEq(deployed, predicted);
    }
}
