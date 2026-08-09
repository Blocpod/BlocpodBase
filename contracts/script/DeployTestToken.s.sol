// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { BaseTokenFactoryV1 } from "../src/BaseTokenFactoryV1.sol";

/// @dev Base Sepolia smoke-test helper. It deliberately refuses to run on Base mainnet.
contract DeployTestToken is Script {
    error BaseSepoliaOnly(uint256 chainId);
    error PredictionMismatch(address predicted, address deployed);

    function run() external returns (address token) {
        if (block.chainid != 84532) revert BaseSepoliaOnly(block.chainid);

        uint256 creatorPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address creator = vm.addr(creatorPrivateKey);
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        address recipient = vm.envAddress("TEST_TOKEN_RECIPIENT");
        bytes32 userSalt = vm.envBytes32("TEST_TOKEN_SALT");
        BaseTokenFactoryV1 factory = BaseTokenFactoryV1(factoryAddress);

        address predicted = factory.predictTokenAddress(
            creator, "Blocpod Test Token", "BTT", 1_000_000 ether, recipient, userSalt
        );

        vm.startBroadcast(creatorPrivateKey);
        token = factory.deployToken(
            "Blocpod Test Token", "BTT", 1_000_000 ether, recipient, userSalt
        );
        vm.stopBroadcast();

        if (token != predicted) revert PredictionMismatch(predicted, token);
        console2.log("token", token);
        console2.log("recipient", recipient);
    }
}
