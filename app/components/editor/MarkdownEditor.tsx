'use client';

import { useState } from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Simple internal Markdown editor
 * Falls back to this when HedgeDoc is not configured
 * Provides basic editing with preview toggle
 */
export default function MarkdownEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'Write your content here...',
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  // Simple markdown to HTML conversion for preview
  const renderMarkdown = (text: string): string => {
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-2 rounded my-2 overflow-x-auto"><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      // Lists
      .replace(/^\- (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/^\* (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4">$2</li>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p class="my-2">')
      // Single newlines
      .replace(/\n/g, '<br/>');

    return `<p class="my-2">${html}</p>`;
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 border-b border-gray-300 px-3 py-2">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`px-3 py-1 text-sm rounded ${!showPreview ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`px-3 py-1 text-sm rounded ${showPreview ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Preview
          </button>
        </div>

        {!showPreview && (
          <div className="flex items-center space-x-1 text-gray-500">
            <button
              type="button"
              onClick={() => onChange(value + '\n# ')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Add heading"
            >
              <span className="text-sm font-bold">H</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(value + '**bold**')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Bold"
            >
              <span className="text-sm font-bold">B</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(value + '*italic*')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Italic"
            >
              <span className="text-sm italic">I</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(value + '\n- ')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Add list item"
            >
              <span className="text-sm">•</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(value + '\n```\ncode\n```')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Add code block"
            >
              <span className="text-sm font-mono">&lt;/&gt;</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor / Preview */}
      {showPreview ? (
        <div
          className="p-4 min-h-[400px] max-h-[600px] overflow-y-auto prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full p-4 min-h-[400px] max-h-[600px] font-mono text-sm resize-y focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
      )}

      {/* Help text */}
      <div className="bg-gray-50 border-t border-gray-300 px-3 py-2 text-xs text-gray-500">
        Supports Markdown: **bold**, *italic*, # headings, - lists, ```code blocks```
      </div>
    </div>
  );
}
