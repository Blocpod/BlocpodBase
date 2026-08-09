# Constrained AgentKit architecture

The uploaded AgentKit archive is the canonical API reference. It identifies itself as `0.11.0`, while
the available npm release used by this repository is `0.10.4`. Blocpod uses only APIs shared by both:
`AgentKit.from`, explicit `ActionProvider` instances, and Zod action schemas. The published `0.10.4`
barrel loads ESM-only protocol adapters through CommonJS; the isolated runtime and its dedicated CI
job therefore use Node 22+, matching the canonical archive prerequisite. Web/backend stay on Node 20.
The adapter is agent-ready but not part of the production dependency set: published AgentKit 0.10.4
currently pulls an unpatched high-severity `bigint-buffer` advisory through an unused Solana adapter.
It remains a development-only, CI-tested integration until Coinbase publishes a dependency graph
without that advisory. Enabling an AgentKit service in production requires a new dependency audit
and release review.

AgentKit defaults to a wallet action provider when no action providers are specified. Blocpod never
uses that default. `createBlocpodAgentKit` always supplies a single explicit provider containing:

- indexed deployment lookup (read-only),
- deployment-intent explanation (read-only and wallet scoped), and
- bounded distribution drafting (unsigned proposal only).

The wallet provider is required by AgentKit's runtime but no signing method is exposed as an action.
Every action input is schema validated, every invocation records request/result hashes, and proposal
policy rejects zero addresses, duplicates, oversized recipient lists, zero totals, and uint256
overflow. Agent outputs are untrusted display/proposal data; deterministic application code rebuilds
and simulates any later transaction.

## Forbidden agent capabilities

- private-key custody or export,
- arbitrary calldata, destinations, selectors, or chain IDs,
- autonomous transfer, approval, deployment, liquidity, vesting, or treasury execution,
- default AgentKit wallet actions,
- accepting instructions from token metadata or indexed text as trusted prompts,
- bypassing wallet review, policy checks, simulation, or mainnet confirmation.

Base Account spend-permission actions are intentionally excluded. If enabled in a later version, each
permission must be opt-in, token-specific, recipient-specific, time-bounded, amount-bounded,
revocable, audited, and protected by an operations kill switch. Human approval is necessary but not
sufficient; deterministic policy remains authoritative.
