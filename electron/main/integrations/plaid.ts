/**
 * Plaid integration — Phase 2 stub.
 * Feature-flagged: only active when PLAID_ENABLED env var is set.
 */

export const PLAID_ENABLED = false

// TODO(Phase 2): implement Plaid client wrapper
// - Exchange public token for access token via PlaidApi
// - Store access token via safeStorage.encryptString
// - Hourly cron job writing balance_snapshots and upserting transactions
