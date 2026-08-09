// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { BlocpodVestingWalletFactoryV1 } from "../src/BlocpodVestingWalletFactoryV1.sol";

contract DeployBlocpodVestingWalletFactoryV1 is Script {
    error UnsupportedChain(uint256 chainId);
    error MainnetConfirmationMissing();

    bytes32 private constant MAINNET_CONFIRMATION =
        keccak256("DEPLOY_BLOCPOD_VESTING_WALLET_FACTORY_V1_TO_BASE");

    function run() external returns (BlocpodVestingWalletFactoryV1 factory) {
        if (block.chainid != 8453 && block.chainid != 84532) {
            revert UnsupportedChain(block.chainid);
        }
        if (
            block.chainid == 8453
                && vm.envOr("VESTING_MAINNET_DEPLOYMENT_CONFIRMATION", bytes32(0))
                    != MAINNET_CONFIRMATION
        ) {
            revert MainnetConfirmationMissing();
        }

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        factory = new BlocpodVestingWalletFactoryV1();
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("BlocpodVestingWalletFactoryV1", address(factory));
        console2.logBytes32(keccak256(address(factory).code));
    }
}
