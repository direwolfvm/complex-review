import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Process models are resolved by tenant_id + title, never by numeric id.
 *
 * The shared Supabase project assigns process_model.id from a single sequence across
 * every tenant, so an id is only meaningful alongside the tenant that owns it. Our own
 * catalog happens to sit at id 1 today, but nothing guarantees that, and hardcoding it
 * risks pointing at another tenant's workflow. See direwolfvm/helppermitme2#7.
 */
export const PROCESS_MODEL_TITLE = 'Complex Environmental Review';

const cachedIds = new Map<string, number>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveProcessModelId(
  supabase: SupabaseClient<any>,
  tenantId: string,
  title: string = PROCESS_MODEL_TITLE
): Promise<number> {
  const cacheKey = `${tenantId}:${title}`;
  const cached = cachedIds.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const { data, error } = await supabase
    .from('process_model')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('title', title)
    .single();

  if (error || !data?.id) {
    throw new Error(`Process model "${title}" not found for this tenant`);
  }

  const id = data.id as number;
  cachedIds.set(cacheKey, id);
  return id;
}
