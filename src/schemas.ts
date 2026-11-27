import { z } from 'zod';

// Successful structured results are explicit. Error results use isError and a
// separate JSON-text { ok:false, error:{code,message,...} } envelope and never raw traces.
export const queuedJobSchema = z.object({
  operation: z.literal('queued'), job_id: z.string().uuid(), status: z.string(),
  poll_after_seconds: z.number().nonnegative().optional(), reused: z.boolean().optional(),
  next_step: z.string(),
  requires_local_human_approval: z.boolean().optional(),
});
export const jobStatusSchema = z.object({
  job_id: z.string().uuid(), kind: z.string(), status: z.string(),
  result: z.string().nullable(), execution_mode: z.literal('outbound_polling'),
  pending_seconds: z.number().nonnegative().nullable(), next_action: z.string().nullable(),
});
export const siteSchema = z.object({
  id: z.string().uuid(), url: z.string(), name: z.string(),
  wordPressVersion: z.string().nullable(), connectorVersion: z.string().nullable(),
  isBlocked: z.boolean(),
});
export const sitesSchema = z.object({ items: z.array(siteSchema) });
export const quotaSchema = z.object({
  site_id: z.string().uuid(), site_name: z.string(), site_url: z.string(),
  plan: z.string(), plan_source: z.string(), used: z.number(), reserved: z.number(),
  failed: z.number(), effective_used: z.number(), limit: z.number(), remaining: z.number(),
  resets_at_utc: z.string(), measured_at_utc: z.string(), timezone: z.literal('UTC'),
  quota_policy: z.literal('per_site'), accounting: z.string(),
});
export const accountUsageSchema = z.object({
  sites: z.array(quotaSchema), site_count: z.number(), used: z.number(), reserved: z.number(),
  failed: z.number(), effective_used: z.number(), remaining: z.number(), limit: z.number(),
  resets_at_utc: z.string(), measured_at_utc: z.string(), timezone: z.literal('UTC'),
  quota_policy: z.literal('per_site'), note: z.string(),
});
export const capabilitySchema = z.object({
  center_version: z.string(), protocol_version: z.string(),
  quota_source: z.string(), site_blocking: z.boolean(), user_blocking: z.boolean(),
  remote_write_enabled: z.boolean(),
  native_builder_enabled: z.boolean().optional(), connector_async_operations: z.boolean(),
  connector_execution_mode: z.string(), immediate_execution_supported: z.boolean(),
  public_oauth_enabled: z.boolean(), quick_pairing_enabled: z.boolean(), passwordless_oauth_enabled: z.boolean(),
  mcp_version: z.string(), mcp_protocol_version: z.string(),
});
const catalogEntry = z.object({
  kind: z.string(), scope: z.string(), requires_confirmation: z.boolean(),
  requires_local_human_approval: z.boolean().optional(),
  needs_revision: z.boolean().optional(), needs_expected_state: z.boolean().optional(),
  wordpress_opt_in: z.string().optional(),
});
export const catalogSchema = z.object({
  version: z.string(), site_id: z.string().uuid(),
  read: z.array(catalogEntry), write: z.array(catalogEntry), workflow: z.string(),
});
export const pairingStatusSchema = z.object({
  status: z.string(), site_id: z.string().uuid().nullable().optional(), next_step: z.string().optional(),
});
export const stagingSchema = z.object({
  source_url: z.string().url(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size_bytes: z.number().int().positive(), file_name: z.string(), package_type: z.enum(['plugin', 'theme']),
  expires_at_utc: z.string(), expires_in: z.number().int().positive(), next_step: z.string(),
});
export const connectionHelpSchema = z.object({
  download_url: z.string().url(), documentation_url: z.string().url(), steps: z.array(z.string()),
});
