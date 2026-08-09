# Release acceptance checklist

A BlocpodBase candidate is complete only when each required item below has dated, reviewable
evidence tied to one immutable source revision. An unchecked item blocks production release.

## Source and build provenance

- [ ] The candidate revision and `pnpm-lock.yaml` are frozen and independently reviewed.
- [ ] `sources/`, `AGENTS.md`, secrets, local environment files, Foundry libraries, build output, and
      broadcast artifacts are absent from the release diff.
- [ ] Node.js 20.18.0, pnpm 9.4.0, Foundry v1.7.1, Solidity 0.8.28, forge-std v1.9.7, and
      OpenZeppelin Contracts v5.6.1 are recorded in the build evidence.
- [ ] A clean checkout installs dependencies and passes GitHub Actions without local caches or
      vendored `contracts/lib` content.

## Automated acceptance

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm ci:application` passes application lint, type checking, unit/integration tests, and
      production builds.
- [ ] `contracts/scripts/contract-acceptance.sh` passes formatting, size checks, unit tests, 10,000
      fuzz cases per fuzz test, 1,000 invariant runs at depth 128, and security-surface checks.
- [ ] CodeQL and dependency review report no unresolved release-blocking findings.

## Contract acceptance

- [ ] Factory creation/runtime bytecode hashes and compiler settings match the reviewed artifacts.
- [ ] Metadata boundaries reject empty values, names over 64 UTF-8 bytes, and symbols over 12 UTF-8
      bytes in both prediction and deployment.
- [ ] Base Sepolia deployment is source verified and prediction, emitted provenance, fixed supply,
      recipient balance, transfer behavior, duplicate salt rejection, and indexer reconciliation are
      confirmed from chain state.
- [ ] An independent smart-contract reviewer confirms there is no owner/admin, mint, pause,
      blacklist, seizure, fee, proxy, `delegatecall`, `selfdestruct`, or factory authority surface.

## Application and operations

- [ ] Wallet onboarding, wrong-network handling, simulation, human-readable review, rejection,
      submission, replacement, confirmation, refresh recovery, and failure paths pass end to end.
- [ ] Authentication, authorization, idempotency, rate limits, secure headers, secret handling,
      database migrations, indexer restart/reorg recovery, and log redaction are exercised.
- [ ] Accessibility, responsive layouts, browser compatibility, empty/loading/error states, and
      production content receive independent UX review.
- [ ] Dashboards, alerts, incident ownership, backups, restore procedure, rollback artifact, and
      support escalation are tested and recorded.

## Production authorization

- [ ] Mainnet factory deployment has explicit approvers, a minimally funded deployer, verified chain
      ID 8453, reviewed bytecode, and the required deployment confirmation.
- [ ] Mainnet factory address, deployment block/transaction, verification URL, bytecode hashes,
      configuration owner, migration version, application artifact, and monitoring links are in the
      release record.
- [ ] Independent contract, application-security, operations, and product owners sign the same
      release record; every release-blocking finding is closed and affected checks are rerun.

The immutable factory cannot be rolled back. If its acceptance fails after deployment, disable the
address in the application and indexer, publish an incident notice, and introduce a separately
reviewed factory version. Never silently replace an advertised factory.
