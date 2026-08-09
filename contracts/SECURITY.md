# Contract security model

## Trust boundaries

- Token creators control the metadata, supply amount, initial recipient, and creator-local salt.
- Wallets control transaction authorization. BlocpodBase never needs custody of a private key.
- The factory records provenance but does not certify a token or its creator.
- RPC, explorer, and indexer data are untrusted presentation inputs and must be checked against the
  selected chain and contract address.

## Invariants

- `totalSupply()` equals the constructor supply for the lifetime of each token.
- Only the initial recipient receives constructor-minted tokens.
- Standard transfers redistribute existing balances without changing total supply.
- A `(creator, userSalt)` pair deploys at most once from a given factory.
- Different creators using the same user salt derive different CREATE2 salts.
- Factory state grants no allowance, ownership, or control over a deployed token.
- Vesting allocations can only remain in the wallet or be released to its immutable beneficiary.

## Known limitations

- ERC-20 name and symbol are arbitrary user-controlled UTF-8 byte sequences within onchain limits of
  64 and 12 bytes respectively. Clients must escape them and apply the same byte-based limits.
- CREATE2 address prediction is factory-, compiler-, dependency-, metadata-, and constructor-specific.
- Fixed supply does not prevent the recipient from transferring, selling, burning by transfer to an
  unrecoverable address, placing tokens in third-party protocols, or concentrating ownership.
- The contracts have not undergone an external audit until an audit report is linked here.
- Vesting is linear and non-revocable. Funding is a separate transfer; sending the wrong asset or
  funding the wrong wallet cannot be reversed by BlocpodBase.

Report suspected vulnerabilities privately to the repository maintainers. Do not include private
keys, seed phrases, or exploitable production details in a public issue.
