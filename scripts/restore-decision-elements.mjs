#!/usr/bin/env node

/**
 * Restore the Review Works decision_element catalog.
 *
 * The catalog was lost once in the migration into the shared Supabase project, which
 * silently turned the step authorization gate into a fail-open and left every
 * process_decision_payload.process_decision_element NULL. This script exists so that
 * repair is reproducible rather than a one-off.
 *
 * The rows live in database-schema/reviewworks-decision-elements.json. Do NOT rebuild
 * them from the CSVs in that directory -- those are upstream GSA-TTS/pic-standards seed
 * data describing a different catalog ("Project Pre-screening", not ours).
 *
 * Idempotent: upserts on primary key, so running it twice is a no-op.
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=sb_secret_... \
 *   TENANT_ID=... node scripts/restore-decision-elements.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, 'database-schema', 'reviewworks-decision-elements.json');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const tenantId = process.env.TENANT_ID;
const dryRun = process.argv.includes('--dry-run');

if (!url || !secretKey || !tenantId) {
  console.error('Set SUPABASE_URL, SUPABASE_SECRET_KEY and TENANT_ID.');
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(CATALOG, 'utf8')).map((row) => ({
  ...row,
  tenant_id: tenantId,
}));

// PostgREST rejects a bulk insert whose objects do not share a key set.
const keys = new Set(rows.flatMap(Object.keys));
for (const row of rows) {
  for (const key of keys) if (!(key in row)) row[key] = null;
}

console.log(`${rows.length} elements for tenant ${tenantId}:`);
for (const row of rows) {
  const { step_number, responsible_role } = row.other ?? {};
  console.log(
    `  id=${row.id} step=${step_number} role=${responsible_role} ${row.title}` +
      (row.form_data ? ` (form: ${Object.keys(row.form_data.properties ?? {}).length} properties)` : '')
  );
}

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
  process.exit(0);
}

const response = await fetch(`${new URL('/rest/v1/decision_element', url)}?on_conflict=id`, {
  method: 'POST',
  headers: {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify(rows),
});

const body = await response.text();
if (!response.ok) {
  console.error(`\nFailed (${response.status}): ${body}`);
  process.exit(1);
}

console.log(`\nRestored ${JSON.parse(body).length} elements.`);
