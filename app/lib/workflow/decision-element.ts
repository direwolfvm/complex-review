import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Find the decision element governing a workflow step.
 *
 * Looked up by tenant plus the step number recorded in `other.step_number`, never by
 * primary key. decision_element ids come from one sequence shared by every tenant in
 * the project, so `id === stepNumber` only ever held by coincidence, and stopped
 * holding at all once our rows went missing and the ids were reused elsewhere. The
 * step number is a fact about our workflow, so it is the thing worth matching on.
 */
export async function findDecisionElementForStep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tenantId: string,
  step: number,
  columns: string = '*'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const { data } = await supabase
    .from('decision_element')
    .select(columns)
    .eq('tenant_id', tenantId)
    .eq('other->>step_number', String(step))
    .single();

  return data ?? null;
}
