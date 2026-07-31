/**
 * Product visibility switches.
 *
 * Nerona sells metadata only for now, so every Agent surface — the marketing
 * page, the pricing tab, the tenant sidebar groups, the agent routes, order
 * creation, and renewal invoices — is hidden behind this one constant.
 *
 * NOT an env var and NOT a Setting row on purpose: an env var can differ
 * between local and production with nothing in the repo to read, and a DB
 * row would cost a query on every nav render plus admin UI, for a switch
 * that gets flipped twice.
 *
 * Flip to `true` to restore every surface. What it does NOT restore: agent
 * renewal invoices that were skipped while it was off, or a plan that lapsed
 * in the meantime.
 *
 * Nothing under src/lib/agent/** is conditional on this — the WhatsApp
 * webhook and the agent job cron keep serving existing users either way.
 */
export const AGENT_ENABLED = false;
