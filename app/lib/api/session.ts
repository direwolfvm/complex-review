import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSecretClient } from '@/lib/supabase/secret';
import { getTenantContextForUser } from '@/lib/tenant/server';
import { canUserAccessStep } from '@/lib/workflow/engine';

export interface ApiSession {
  userId: string;
  tenantId: string;
  role: string | null;
  /** Privileged client. Every write in a route handler goes through this. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/**
 * Establishes who is calling before any write happens.
 *
 * The browser no longer writes to PostgREST directly, so this is the only place the
 * caller's identity is established: the session comes from the cookie-bound client,
 * and membership from getTenantContextForUser, which throws when the user has no
 * active membership in the configured tenant.
 */
export async function requireSession(): Promise<ApiSession> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, 'Not signed in');
  }

  let context;
  try {
    context = await getTenantContextForUser(user.id);
  } catch {
    throw new ApiError(403, 'No active tenant membership');
  }

  return {
    userId: user.id,
    tenantId: context.tenantId,
    role: context.role,
    db: createSecretClient(),
  };
}

/**
 * Authorization for a step action.
 *
 * canUserAccessStep previously ran only when a page rendered, while the write itself
 * went straight from the browser to PostgREST unchecked. Routes call this so the same
 * rule applies to the write.
 */
export async function requireStepAccess(session: ApiSession, step: number, processInstanceId: number) {
  const { canAccess } = await canUserAccessStep(
    session.db,
    session.userId,
    step,
    processInstanceId,
    session.tenantId
  );

  if (!canAccess) {
    throw new ApiError(403, `Not permitted to act on step ${step} of this case`);
  }
}

/** Confirms the process belongs to the caller's tenant before anything touches it. */
export async function requireProcessInTenant(session: ApiSession, processInstanceId: number) {
  const { data, error } = await session.db
    .from('process_instance')
    .select('*, project:parent_project_id(*)')
    .eq('id', processInstanceId)
    .eq('tenant_id', session.tenantId)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Case not found');
  }

  return data;
}
