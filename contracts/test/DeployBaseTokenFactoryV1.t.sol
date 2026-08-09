// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { BaseTokenFactoryV1 } from "../src/BaseTokenFactoryV1.sol";
import { DeployBaseTokenFactoryV1 } from "../script/DeployBaseTokenFactoryV1.s.sol";

contract DeployBaseTokenFactoryV1Test is Test {
    DeployBaseTokenFactoryV1 private script;
    uint256 private deployerKey = 0xB10C;

    function setUp() external {
        script = new DeployBaseTokenFactoryV1();
        vm.setEnv("DEPLOYER_PRIVATE_KEY", vm.toString(deployerKey));
    }

    function test_DeploysOnBaseSepolia() external {
        vm.chainId(84532);
        BaseTokenFactoryV1 factory = script.run();
        assertTrue(address(factory).code.length != 0);
    }

    function test_RevertOnUnsupportedChain() external {
        vm.chainId(1);
        vm.expectRevert(
            abi.encodeWithSelector(DeployBaseTokenFactoryV1.UnsupportedChain.selector, 1)
        );
        script.run();
    }

    function test_RevertOnMainnetWithoutExplicitConfirmation() external {
        vm.chainId(8453);
        vm.expectRevert(DeployBaseTokenFactoryV1.MainnetConfirmationMissing.selector);
        script.run();
    }
}
