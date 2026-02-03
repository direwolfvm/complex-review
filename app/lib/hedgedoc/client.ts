/**
 * HedgeDoc Integration Client
 *
 * Provides integration with HedgeDoc for collaborative document editing.
 * Falls back to internal markdown storage if HedgeDoc is not configured.
 */

interface HedgeDocConfig {
  baseUrl: string;
  apiToken?: string;
}

interface CreateNoteResult {
  noteId: string;
  url: string;
}

interface NoteContent {
  content: string;
  title?: string;
}

/**
 * Check if HedgeDoc is configured
 */
export function isHedgeDocConfigured(): boolean {
  return !!process.env.HEDGEDOC_BASE_URL;
}

/**
 * Get HedgeDoc configuration
 */
function getConfig(): HedgeDocConfig | null {
  const baseUrl = process.env.HEDGEDOC_BASE_URL;
  if (!baseUrl) return null;

  return {
    baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
    apiToken: process.env.HEDGEDOC_API_TOKEN,
  };
}

/**
 * Create a new HedgeDoc note
 */
export async function createNote(
  title: string,
  initialContent: string
): Promise<CreateNoteResult | null> {
  const config = getConfig();
  if (!config) {
    console.log('HedgeDoc not configured, using internal storage');
    return null;
  }

  try {
    const headers: HeadersInit = {
      'Content-Type': 'text/markdown',
    };

    if (config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken}`;
    }

    // HedgeDoc API: POST /new to create a new note
    const response = await fetch(`${config.baseUrl}/new`, {
      method: 'POST',
      headers,
      body: `# ${title}\n\n${initialContent}`,
    });

    if (!response.ok) {
      console.error('HedgeDoc create note failed:', response.status, response.statusText);
      return null;
    }

    // HedgeDoc should return the URL of the new note (Location header or final URL)
    const noteUrl = response.headers.get('location') || response.url;
    if (!noteUrl) {
      console.error('HedgeDoc did not return note URL');
      return null;
    }

    // Guard against non-note redirects (e.g., /new or auth pages)
    const lowerUrl = noteUrl.toLowerCase();
    if (
      lowerUrl.endsWith('/new') ||
      lowerUrl.includes('/login') ||
      lowerUrl.includes('/signin') ||
      lowerUrl.includes('/auth')
    ) {
      console.error('HedgeDoc did not return a note URL:', noteUrl);
      return null;
    }

    // Extract note ID from URL (last path segment)
    const parsedUrl = new URL(noteUrl, config.baseUrl);
    const noteId = parsedUrl.pathname.split('/').pop() || '';
    if (!noteId || noteId === 'new') {
      console.error('HedgeDoc note ID missing from URL:', noteUrl);
      return null;
    }

    return {
      noteId,
      url: noteUrl,
    };
  } catch (error) {
    console.error('HedgeDoc create note error:', error);
    return null;
  }
}

/**
 * Get note content from HedgeDoc
 */
export async function getNote(noteId: string): Promise<NoteContent | null> {
  const config = getConfig();
  if (!config) {
    return null;
  }

  try {
    const headers: HeadersInit = {};

    if (config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken}`;
    }

    // HedgeDoc API: GET /{noteId}/download to get markdown content
    const response = await fetch(`${config.baseUrl}/${noteId}/download`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      console.error('HedgeDoc get note failed:', response.status, response.statusText);
      return null;
    }

    const content = await response.text();

    // Extract title from first heading if present
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : undefined;

    return {
      content,
      title,
    };
  } catch (error) {
    console.error('HedgeDoc get note error:', error);
    return null;
  }
}

/**
 * Get the edit URL for a note
 */
export function getNoteEditUrl(noteId: string): string | null {
  const config = getConfig();
  if (!config) {
    return null;
  }

  return `${config.baseUrl}/${noteId}`;
}

/**
 * Get the view URL for a note (published/read-only view)
 */
export function getNoteViewUrl(noteId: string): string | null {
  const config = getConfig();
  if (!config) {
    return null;
  }

  return `${config.baseUrl}/s/${noteId}`;
}

/**
 * Check if embedding is allowed (for iframe usage)
 * Note: This depends on HedgeDoc server configuration
 */
export function isEmbeddingAllowed(): boolean {
  // By default, assume embedding is not allowed for security
  // This should be configured based on actual HedgeDoc server settings
  return process.env.HEDGEDOC_ALLOW_EMBED === 'true';
}
