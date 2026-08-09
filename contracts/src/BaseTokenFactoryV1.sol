// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { BaseToken } from "./BaseToken.sol";

/// @title BaseTokenFactoryV1
/// @notice Permissionlessly deploys immutable, fixed-supply ERC-20 tokens at predictable addresses.
/// @dev User salts are namespaced by creator so two creators may safely choose the same user salt.
///      This contract has no owner, privileged role, upgrade path, or control over deployed tokens.
contract BaseTokenFactoryV1 {
    uint256 private constant _MAX_NAME_BYTES = 64;
    uint256 private constant _MAX_SYMBOL_BYTES = 12;

    error EmptyName();
    error EmptySymbol();
    error NameTooLong(uint256 length, uint256 maxLength);
    error SymbolTooLong(uint256 length, uint256 maxLength);
    error ZeroInitialRecipient();
    error ZeroInitialSupply();
    error SaltAlreadyUsed(address creator, bytes32 userSalt, address token);

    /// @notice Emitted after a token has been successfully deployed.
    /// @param creator Account that called deployToken.
    /// @param token Address of the newly deployed token.
    /// @param deploymentSalt Creator-namespaced CREATE2 salt used by the factory.
    /// @param initialRecipient Account that received the complete initial supply.
    /// @param name ERC-20 name.
    /// @param symbol ERC-20 symbol.
    /// @param initialSupply Supply in the token's smallest unit (18 decimals).
    /// @param userSalt Salt supplied by the creator before namespacing.
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

    /// @dev Namespaced salt => deployed token. A nonzero value permanently marks a salt as used.
    mapping(bytes32 deploymentSalt => address token) private _deployments;

    /// @notice Deploy an immutable fixed-supply token using CREATE2.
    function deployToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        address initialRecipient,
        bytes32 userSalt
    ) external returns (address token) {
        _validate(name, symbol, initialSupply, initialRecipient);

        bytes32 deploymentSalt = computeDeploymentSalt(msg.sender, userSalt);
        address existing = _deployments[deploymentSalt];
        if (existing != address(0)) {
            revert SaltAlreadyUsed(msg.sender, userSalt, existing);
        }

        token = address(
            new BaseToken{ salt: deploymentSalt }(name, symbol, initialSupply, initialRecipient)
        );
        _deployments[deploymentSalt] = token;

        emit TokenDeployed(
            msg.sender,
            token,
            deploymentSalt,
            initialRecipient,
            name,
            symbol,
            initialSupply,
            userSalt
        );
    }

    /// @notice Return the deployed token for a creator/user-salt pair, or address(0) if unused.
    function deploymentOf(address creator, bytes32 userSalt) external view returns (address) {
        return _deployments[computeDeploymentSalt(creator, userSalt)];
    }

    /// @notice Derive the CREATE2 salt used by this factory.
    function computeDeploymentSalt(address creator, bytes32 userSalt)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(creator, userSalt));
    }

    /// @notice Predict a token address before deployment.
    /// @dev The result depends on all constructor arguments as well as the creator and user salt.
    function predictTokenAddress(
        address creator,
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        address initialRecipient,
        bytes32 userSalt
    ) external view returns (address predicted) {
        _validate(name, symbol, initialSupply, initialRecipient);

        bytes32 deploymentSalt = computeDeploymentSalt(creator, userSalt);
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(BaseToken).creationCode,
                abi.encode(name, symbol, initialSupply, initialRecipient)
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

    function _validate(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        address initialRecipient
    ) private pure {
        uint256 nameLength = bytes(name).length;
        uint256 symbolLength = bytes(symbol).length;
        if (nameLength == 0) revert EmptyName();
        if (nameLength > _MAX_NAME_BYTES) revert NameTooLong(nameLength, _MAX_NAME_BYTES);
        if (symbolLength == 0) revert EmptySymbol();
        if (symbolLength > _MAX_SYMBOL_BYTES) {
            revert SymbolTooLong(symbolLength, _MAX_SYMBOL_BYTES);
        }
        if (initialRecipient == address(0)) revert ZeroInitialRecipient();
        if (initialSupply == 0) revert ZeroInitialSupply();
    }
}
