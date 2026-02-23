#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/jke/Github-local/complex-review';
const COPILOTKIT_ENV = '/Users/jke/Github-local/copilotkit-forms/app/.env';
const LOCAL_ENV = path.join(ROOT, '.env');
const TENANT_SLUG = process.env.TENANT_SLUG || 'reviewworks';

function parseEnvFile(filePath) {
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const localEnv = parseEnvFile(LOCAL_ENV);
const copilotEnv = parseEnvFile(COPILOTKIT_ENV);

const source = {
  url: localEnv.NEXT_PUBLIC_SUPABASE_URL || copilotEnv.REVIEWWORKS_SUPABASE_URL,
  key: localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || localEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || copilotEnv.REVIEWWORKS_SUPABASE_ANON_KEY,
};

const target = {
  url: copilotEnv.VITE_SUPABASE_URL,
  key: copilotEnv.VITE_SUPABASE_ANON_KEY,
};

for (const [name, cfg] of Object.entries({ source, target })) {
  if (!cfg.url || !cfg.key) {
    throw new Error(`Missing ${name} Supabase URL/key`);
  }
}

async function rest(base, { method = 'GET', table, query = '', body, prefer, onConflict } = {}) {
  const url = new URL(`/rest/v1/${table}`, base.url);
  if (query) {
    const search = new URLSearchParams(query);
    for (const [k, v] of search.entries()) url.searchParams.set(k, v);
  }
  if (onConflict) url.searchParams.set('on_conflict', onConflict);

  const headers = {
    apikey: base.key,
    Authorization: `Bearer ${base.key}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${url.pathname} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchAll(base, table, order = 'id') {
  return await rest(base, {
    table,
    query: `select=*&order=${order}.asc`,
  });
}

function omit(obj, keys) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out;
}

function mapNullable(value, map) {
  if (value === null || value === undefined) return null;
  const mapped = map.get(value);
  if (mapped === undefined) throw new Error(`Missing mapping for id ${value}`);
  return mapped;
}

async function main() {
  console.log(`Migrating ReviewWorks data to canonical tenant "${TENANT_SLUG}"...`);

  const [tenant] = await rest(target, {
    table: 'tenant',
    query: `select=*&slug=eq.${TENANT_SLUG}&limit=1`,
  });
  if (!tenant?.id) throw new Error(`Target tenant "${TENANT_SLUG}" not found`);
  const tenantId = tenant.id;

  const existing = await rest(target, {
    table: 'project',
    query: `select=id&tenant_id=eq.${tenantId}&limit=1`,
  });
  if (Array.isArray(existing) && existing.length > 0) {
    throw new Error(`Target tenant "${TENANT_SLUG}" already has project rows; aborting to avoid duplicate migration`);
  }

  const sourceData = {
    legal_structure: await fetchAll(source, 'legal_structure'),
    user_role: await fetchAll(source, 'user_role'),
    process_model: await fetchAll(source, 'process_model'),
    decision_element: await fetchAll(source, 'decision_element'),
    user_assignments: await fetchAll(source, 'user_assignments'),
    project: await fetchAll(source, 'project'),
    process_instance: await fetchAll(source, 'process_instance'),
    document: await fetchAll(source, 'document'),
    case_event: await fetchAll(source, 'case_event'),
    process_decision_payload: await fetchAll(source, 'process_decision_payload'),
  };

  console.log('Source row counts:', Object.fromEntries(Object.entries(sourceData).map(([k, v]) => [k, v.length])));

  // Seed/config tables: preserve IDs.
  for (const table of ['legal_structure', 'user_role', 'process_model', 'decision_element']) {
    const rows = sourceData[table].map(row => {
      if (table !== 'decision_element') {
        return { ...row, tenant_id: tenantId };
      }

      const { responsible_role, other, ...rest } = row;
      return {
        ...rest,
        tenant_id: tenantId,
        other: {
          ...(other || {}),
          ...(responsible_role != null ? { responsible_role } : {}),
        },
      };
    });
    if (rows.length === 0) continue;
    await rest(target, {
      method: 'POST',
      table,
      body: rows,
      onConflict: 'id',
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  // Tenant-scoped role assignments.
  if (sourceData.user_assignments.length > 0) {
    const rows = sourceData.user_assignments.map(row => ({ ...row, tenant_id: tenantId }));
    await rest(target, {
      method: 'POST',
      table: 'user_assignments',
      body: rows,
      onConflict: 'id',
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  const projectMap = new Map();
  for (const row of sourceData.project) {
    const insertRow = {
      ...omit(row, ['id', 'tenant_id']),
      tenant_id: tenantId,
    };
    const [created] = await rest(target, {
      method: 'POST',
      table: 'project',
      body: insertRow,
      prefer: 'return=representation',
    });
    projectMap.set(row.id, created.id);
  }

  const processMap = new Map();
  for (const row of sourceData.process_instance) {
    const insertRow = {
      ...omit(row, ['id', 'tenant_id']),
      parent_project_id: mapNullable(row.parent_project_id, projectMap),
      parent_process_id: null,
      tenant_id: tenantId,
    };
    const [created] = await rest(target, {
      method: 'POST',
      table: 'process_instance',
      body: insertRow,
      prefer: 'return=representation',
    });
    processMap.set(row.id, created.id);
  }
  for (const row of sourceData.process_instance.filter(r => r.parent_process_id)) {
    await rest(target, {
      method: 'PATCH',
      table: 'process_instance',
      query: `id=eq.${processMap.get(row.id)}&tenant_id=eq.${tenantId}`,
      body: { parent_process_id: mapNullable(row.parent_process_id, processMap) },
      prefer: 'return=minimal',
    });
  }

  const documentMap = new Map();
  for (const row of sourceData.document) {
    const insertRow = {
      ...omit(row, ['id', 'tenant_id', 'related_document_id']),
      parent_process_id: mapNullable(row.parent_process_id, processMap),
      tenant_id: tenantId,
      related_document_id: null,
    };
    const [created] = await rest(target, {
      method: 'POST',
      table: 'document',
      body: insertRow,
      prefer: 'return=representation',
    });
    documentMap.set(row.id, created.id);
  }
  for (const row of sourceData.document.filter(r => r.related_document_id)) {
    await rest(target, {
      method: 'PATCH',
      table: 'document',
      query: `id=eq.${documentMap.get(row.id)}&tenant_id=eq.${tenantId}`,
      body: { related_document_id: mapNullable(row.related_document_id, documentMap) },
      prefer: 'return=minimal',
    });
  }

  const caseEventMap = new Map();
  for (const row of sourceData.case_event) {
    const insertRow = {
      ...omit(row, ['id', 'tenant_id', 'parent_event_id', 'related_document_id', 'related_engagement_id']),
      parent_process_id: mapNullable(row.parent_process_id, processMap),
      parent_event_id: null,
      related_document_id: row.related_document_id ? mapNullable(row.related_document_id, documentMap) : null,
      related_engagement_id: null,
      tenant_id: tenantId,
    };
    const [created] = await rest(target, {
      method: 'POST',
      table: 'case_event',
      body: insertRow,
      prefer: 'return=representation',
    });
    caseEventMap.set(row.id, created.id);
  }
  for (const row of sourceData.case_event.filter(r => r.parent_event_id)) {
    await rest(target, {
      method: 'PATCH',
      table: 'case_event',
      query: `id=eq.${caseEventMap.get(row.id)}&tenant_id=eq.${tenantId}`,
      body: { parent_event_id: mapNullable(row.parent_event_id, caseEventMap) },
      prefer: 'return=minimal',
    });
  }

  const payloadMap = new Map();
  for (const row of sourceData.process_decision_payload) {
    const insertRow = {
      ...omit(row, ['id', 'tenant_id', 'parent_payload']),
      process: row.process ? mapNullable(row.process, processMap) : null,
      project: row.project ? mapNullable(row.project, projectMap) : null,
      parent_payload: null,
      tenant_id: tenantId,
    };
    const [created] = await rest(target, {
      method: 'POST',
      table: 'process_decision_payload',
      body: insertRow,
      prefer: 'return=representation',
    });
    payloadMap.set(row.id, created.id);
  }
  for (const row of sourceData.process_decision_payload.filter(r => r.parent_payload)) {
    await rest(target, {
      method: 'PATCH',
      table: 'process_decision_payload',
      query: `id=eq.${payloadMap.get(row.id)}&tenant_id=eq.${tenantId}`,
      body: { parent_payload: mapNullable(row.parent_payload, payloadMap) },
      prefer: 'return=minimal',
    });
  }

  console.log('Migration complete.');
  console.log({
    tenantId,
    inserted: {
      projects: projectMap.size,
      processes: processMap.size,
      documents: documentMap.size,
      caseEvents: caseEventMap.size,
      payloads: payloadMap.size,
      userAssignments: sourceData.user_assignments.length,
    },
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
