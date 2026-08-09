// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { BlocpodVestingWalletV1 } from "./BlocpodVestingWalletV1.sol";

/// @title BlocpodVestingWalletFactoryV1
/// @notice Permissionlessly deploys predictable, non-revocable linear vesting wallets.
contract BlocpodVestingWalletFactoryV1 {
    error ZeroBeneficiary();
    error ZeroDuration();
    error SaltAlreadyUsed(address creator, bytes32 userSalt, address vestingWallet);

    event VestingWalletDeployed(
        address indexed creator,
        address indexed vestingWallet,
        bytes32 indexed deploymentSalt,
        address beneficiary,
        uint64 startTimestamp,
        uint64 durationSeconds,
        bytes32 userSalt
    );

    mapping(bytes32 deploymentSalt => address vestingWallet) private _deployments;

    function deployVestingWallet(
        address beneficiary,
        uint64 startTimestamp,
        uint64 durationSeconds,
        bytes32 userSalt
    ) external returns (address vestingWallet) {
        _validate(beneficiary, durationSeconds);
        bytes32 deploymentSalt = computeDeploymentSalt(msg.sender, userSalt);
        address existing = _deployments[deploymentSalt];
        if (existing != address(0)) {
            revert SaltAlreadyUsed(msg.sender, userSalt, existing);
        }

        vestingWallet = address(
            new BlocpodVestingWalletV1{ salt: deploymentSalt }(
                beneficiary, startTimestamp, durationSeconds
            )
        );
        _deployments[deploymentSalt] = vestingWallet;

        emit VestingWalletDeployed(
            msg.sender,
            vestingWallet,
            deploymentSalt,
            beneficiary,
            startTimestamp,
            durationSeconds,
            userSalt
        );
    }

    function deploymentOf(address creator, bytes32 userSalt) external view returns (address) {
        return _deployments[computeDeploymentSalt(creator, userSalt)];
    }

    function computeDeploymentSalt(address creator, bytes32 userSalt)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(creator, userSalt));
    }

    function predictVestingWalletAddress(
        address creator,
        address beneficiary,
        uint64 startTimestamp,
        uint64 durationSeconds,
        bytes32 userSalt
    ) external view returns (address predicted) {
        _validate(beneficiary, durationSeconds);
        bytes32 deploymentSalt = computeDeploymentSalt(creator, userSalt);
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(BlocpodVestingWalletV1).creationCode,
                abi.encode(beneficiary, startTimestamp, durationSeconds)
            )
        );

        predicted = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), address(this), deploymentSalt, initCodeHash)
                    )
                )
            )
        );
    }

    function _validate(address beneficiary, uint64 durationSeconds) private pure {
        if (beneficiary == address(0)) revert ZeroBeneficiary();
        if (durationSeconds == 0) revert ZeroDuration();
    }
}
