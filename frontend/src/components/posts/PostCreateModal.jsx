import React, { useEffect, useRef, useState } from 'react';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import { useProtectedApi } from '../../hooks/useProtectedApi';
import './PostCreateModal.css';

/**
 * Converts an EditorJS output object into a plain markdown string
 * suitable for the `body_markdown` API field.
 */
function editorDataToMarkdown(data) {
  if (!data || !data.blocks) return '';
  return data.blocks
    .map((block) => {
      switch (block.type) {
        case 'header': {
          const level = block.data.level || 2;
          const prefix = '#'.repeat(level);
          return `${prefix} ${block.data.text}`;
        }
        case 'list': {
          const items = block.data.items || [];
          if (block.data.style === 'ordered') {
            return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
          }
          return items.map((item) => `- ${item}`).join('\n');
        }
        case 'paragraph':
        default:
          // Strip basic HTML tags EditorJS may leave in text
          return (block.data.text || '').replace(/<[^>]+>/g, '');
      }
    })
    .join('\n\n');
}

const EDITOR_HOLDER_ID = 'post-create-editorjs';

const PostCreateModal = ({ onClose, onPostCreated }) => {
  const { post: apiPost } = useProtectedApi();
  const editorRef = useRef(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('text');
  const [linkUrl, setLinkUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialise EditorJS once the modal mounts
  useEffect(() => {
    if (editorRef.current) return; // already initialised

    editorRef.current = new EditorJS({
      holder: EDITOR_HOLDER_ID,
      placeholder: 'Write your post...',
      tools: {
        header: {
          class: Header,
          config: { levels: [2, 3, 4], defaultLevel: 2 },
        },
        list: {
          class: List,
          inlineToolbar: true,
        },
      },
      minHeight: 120,
    });

    return () => {
      if (editorRef.current && editorRef.current.destroy) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    let bodyMarkdown = '';
    if (kind === 'text' && editorRef.current) {
      try {
        const editorData = await editorRef.current.save();
        bodyMarkdown = editorDataToMarkdown(editorData);
      } catch {
        setError('Failed to save editor content.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        kind,
        status: 'published',
        ...(kind === 'text' ? { body_markdown: bodyMarkdown } : {}),
        ...(kind === 'link' ? { link_url: linkUrl.trim() } : {}),
      };

      const created = await apiPost('/posts/', payload);
      if (onPostCreated) onPostCreated(created);
      onClose();
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.title?.[0] ||
        'Failed to create post. Please try again.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pcm-overlay" onClick={onClose}>
      <div className="pcm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Window chrome matching existing WindowCard */}
        <div className="pcm-header">
          <div className="pcm-window-controls">
            <span className="pcm-btn pcm-btn-close" onClick={onClose} />
            <span className="pcm-btn pcm-btn-min" />
            <span className="pcm-btn pcm-btn-max" />
          </div>
          <span className="pcm-title">NEW POST</span>
        </div>

        <div className="pcm-body">
          <form onSubmit={handleSubmit} noValidate>
            {/* Title */}
            <div className="pcm-field">
              <label className="pcm-label" htmlFor="pcm-title">
                Title
              </label>
              <input
                id="pcm-title"
                className="pcm-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title..."
                maxLength={300}
                autoFocus
              />
            </div>

            {/* Kind selector */}
            <div className="pcm-field">
              <label className="pcm-label">Type</label>
              <div className="pcm-kind-row">
                {['text', 'link'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`pcm-kind-btn${kind === k ? ' active' : ''}`}
                    onClick={() => setKind(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor.js (text) or URL (link) */}
            {kind === 'text' ? (
              <div className="pcm-field">
                <label className="pcm-label">Content</label>
                <div id={EDITOR_HOLDER_ID} className="pcm-editor-holder" />
              </div>
            ) : (
              <div className="pcm-field">
                <label className="pcm-label" htmlFor="pcm-link">
                  URL
                </label>
                <input
                  id="pcm-link"
                  className="pcm-input"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            {error && <p className="pcm-error">{error}</p>}

            <div className="pcm-actions">
              <button
                type="button"
                className="pcm-cancel-btn"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pcm-submit-btn"
                disabled={submitting}
              >
                {submitting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostCreateModal;
