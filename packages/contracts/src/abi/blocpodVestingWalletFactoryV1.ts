export const blocpodVestingWalletFactoryV1Abi = [
  { type: "error", name: "ZeroBeneficiary", inputs: [] },
  { type: "error", name: "ZeroDuration", inputs: [] },
  { type: "error", name: "SaltAlreadyUsed", inputs: [{ name: "creator", type: "address" }, { name: "userSalt", type: "bytes32" }, { name: "vestingWallet", type: "address" }] },
  {
    type: "event", name: "VestingWalletDeployed", anonymous: false,
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "vestingWallet", type: "address", indexed: true },
      { name: "deploymentSalt", type: "bytes32", indexed: true },
      { name: "beneficiary", type: "address", indexed: false },
      { name: "startTimestamp", type: "uint64", indexed: false },
      { name: "durationSeconds", type: "uint64", indexed: false },
      { name: "userSalt", type: "bytes32", indexed: false },
    ],
  },
  { type: "function", name: "computeDeploymentSalt", inputs: [{ name: "creator", type: "address" }, { name: "userSalt", type: "bytes32" }], outputs: [{ name: "", type: "bytes32" }], stateMutability: "pure" },
  { type: "function", name: "deployVestingWallet", inputs: [{ name: "beneficiary", type: "address" }, { name: "startTimestamp", type: "uint64" }, { name: "durationSeconds", type: "uint64" }, { name: "userSalt", type: "bytes32" }], outputs: [{ name: "vestingWallet", type: "address" }], stateMutability: "nonpayable" },
  { type: "function", name: "deploymentOf", inputs: [{ name: "creator", type: "address" }, { name: "userSalt", type: "bytes32" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "predictVestingWalletAddress", inputs: [{ name: "creator", type: "address" }, { name: "beneficiary", type: "address" }, { name: "startTimestamp", type: "uint64" }, { name: "durationSeconds", type: "uint64" }, { name: "userSalt", type: "bytes32" }], outputs: [{ name: "predicted", type: "address" }], stateMutability: "view" },
] as const;
