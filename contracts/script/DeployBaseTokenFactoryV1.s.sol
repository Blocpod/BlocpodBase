// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { BaseTokenFactoryV1 } from "../src/BaseTokenFactoryV1.sol";

contract DeployBaseTokenFactoryV1 is Script {
    error UnsupportedChain(uint256 chainId);
    error MainnetConfirmationMissing();

    uint256 private constant BASE_MAINNET = 8453;
    uint256 private constant BASE_SEPOLIA = 84532;
    bytes32 private constant MAINNET_CONFIRMATION = keccak256("DEPLOY_BLOCPOD_FACTORY_V1_TO_BASE");

    function run() external returns (BaseTokenFactoryV1 factory) {
        if (block.chainid != BASE_MAINNET && block.chainid != BASE_SEPOLIA) {
            revert UnsupportedChain(block.chainid);
        }
        if (block.chainid == BASE_MAINNET) {
            bytes32 suppliedConfirmation = vm.envOr("MAINNET_DEPLOYMENT_CONFIRMATION", bytes32(0));
            if (suppliedConfirmation != MAINNET_CONFIRMATION) revert MainnetConfirmationMissing();
        }

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        factory = new BaseTokenFactoryV1();
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("deployer", deployer);
        console2.log("BaseTokenFactoryV1", address(factory));
        console2.logBytes32(keccak256(address(factory).code));
    }
}
