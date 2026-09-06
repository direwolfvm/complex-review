import { SupabaseClient } from '@supabase/supabase-js';
import { createNote, isHedgeDocConfigured } from '@/lib/hedgedoc/client';
import type { DocumentWorkflowMeta } from '@/lib/types/database';

/** Which workflow step owns a document, and therefore who may edit it. */
export const STEP_FOR_DOCUMENT_ROLE: Record<string, number> = {
  draft: 3,
  analysis: 4,
};

export interface DocumentContext {
  id: number;
  parentProcessId: number;
  step: number;
  meta: DocumentWorkflowMeta;
  title: string;
}

/**
 * Load a document and work out which step governs it.
 *
 * The step is what the caller has to be allowed to act on, so it is resolved here from
 * the document's own role rather than trusted from the request.
 */
export async function loadDocumentContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tenantId: string,
  documentId: number
): Promise<DocumentContext | null> {
  const { data, error } = await supabase
    .from('document')
    .select('*')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) return null;

  const meta = (data.other as DocumentWorkflowMeta) || {};
  const role = meta.document_role || data.document_type;
  const step = STEP_FOR_DOCUMENT_ROLE[role as string];

  if (!step) return null;

  return {
    id: data.id as number,
    parentProcessId: data.parent_process_id as number,
    step,
    meta,
    title: (data.title as string) || 'Untitled',
  };
}

/** Save editor content onto a document. */
export async function saveDocumentContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tenantId: string,
  userId: string,
  doc: DocumentContext,
  content: string
): Promise<void> {
  await supabase
    .from('document')
    .update({
      other: { ...doc.meta, markdown_content: content, last_edited_by_user_id: userId },
    })
    .eq('id', doc.id)
    .eq('tenant_id', tenantId);
}

/**
 * Return the document's HedgeDoc note, creating and recording one if it has none.
 * Idempotent, so the editor can call it on every mount.
 */
export async function ensureHedgeDocNote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tenantId: string,
  doc: DocumentContext
): Promise<{ noteId: string; url: string } | null> {
  if (!isHedgeDocConfigured()) return null;

  if (doc.meta.hedgedoc_note_id && doc.meta.hedgedoc_url) {
    return { noteId: doc.meta.hedgedoc_note_id, url: doc.meta.hedgedoc_url };
  }

  const note = await createNote(doc.title, doc.meta.markdown_content || '');
  if (!note) return null;

  await supabase
    .from('document')
    .update({
      other: { ...doc.meta, hedgedoc_note_id: note.noteId, hedgedoc_url: note.url },
    })
    .eq('id', doc.id)
    .eq('tenant_id', tenantId);

  return note;
}
