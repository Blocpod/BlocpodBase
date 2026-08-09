BEGIN;

CREATE TABLE IF NOT EXISTS deployment_intents (
  id uuid PRIMARY KEY,
  idempotency_key uuid NOT NULL,
  creator text NOT NULL CHECK (creator ~ '^0x[0-9A-Fa-f]{40}$'),
  chain_id integer NOT NULL CHECK (chain_id IN (8453, 84532)),
  factory text NOT NULL CHECK (factory ~ '^0x[0-9A-Fa-f]{40}$'),
  factory_version text NOT NULL,
  calldata text NOT NULL CHECK (calldata ~ '^0x[0-9A-Fa-f]+$'),
  calldata_hash text NOT NULL CHECK (calldata_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  parameters jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','simulated','submitted','confirmed','failed','expired')),
  simulation jsonb,
  transaction_hash text CHECK (transaction_hash IS NULL OR transaction_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator, idempotency_key)
);

CREATE INDEX IF NOT EXISTS deployment_intents_creator_created_idx
  ON deployment_intents (creator, created_at DESC);

CREATE TABLE IF NOT EXISTS token_deployments (
  chain_id integer NOT NULL CHECK (chain_id IN (8453, 84532)),
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  block_number bigint NOT NULL,
  block_hash text NOT NULL,
  factory text NOT NULL,
  factory_version text NOT NULL,
  creator text NOT NULL,
  token text NOT NULL,
  deployment_salt text NOT NULL,
  initial_recipient text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  initial_supply numeric(78, 0) NOT NULL,
  user_salt text NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, transaction_hash, log_index),
  UNIQUE (chain_id, token)
);

CREATE INDEX IF NOT EXISTS token_deployments_creator_idx
  ON token_deployments (chain_id, creator, block_number DESC);

CREATE TABLE IF NOT EXISTS indexer_cursors (
  chain_id integer NOT NULL,
  factory text NOT NULL,
  next_block bigint NOT NULL,
  last_block_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, factory)
);

CREATE TABLE IF NOT EXISTS indexed_blocks (
  chain_id integer NOT NULL,
  factory text NOT NULL,
  block_number bigint NOT NULL,
  block_hash text NOT NULL,
  PRIMARY KEY (chain_id, factory, block_number)
);

CREATE TABLE IF NOT EXISTS agent_audit_events (
  id uuid PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  chain_id integer CHECK (chain_id IS NULL OR chain_id IN (8453, 84532)),
  request_hash text NOT NULL,
  result_hash text,
  decision text NOT NULL CHECK (decision IN ('allowed','denied','proposed','failed')),
  reason_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  scope text NOT NULL,
  subject_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (scope, subject_hash, window_start)
);

COMMIT;
