import React, { useCallback, useEffect, useRef, useState } from "react";
import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import ImageTool from "@editorjs/image";
import {
  uploadMediaFile,
  validateMediaFile,
  MAX_FILE_MB,
} from "../../lib/uploadMedia";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import "./PostCreateModal.css";

/**
 * Converts an EditorJS output object into a plain markdown string
 * suitable for the `body_markdown` API field.
 */
function editorDataToMarkdown(data) {
  if (!data || !data.blocks) return "";
  return data.blocks
    .map((block) => {
      switch (block.type) {
        case "header": {
          const level = block.data.level || 2;
          const prefix = "#".repeat(level);
          return `${prefix} ${block.data.text}`;
        }
        case "list": {
          const items = block.data.items || [];
          if (block.data.style === "ordered") {
            return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
          }
          return items.map((item) => `- ${item}`).join("\n");
        }
        case "image": {
          // EditorJS Image tool stores url in file.url (uploaded) or url (pasted)
          const imgUrl = block.data.file?.url || block.data.url || "";
          const imgAlt = block.data.caption || "image";
          if (!imgUrl) {
            console.warn(
              "[PostCreate] Image block has no URL — skipping",
              block.data,
            );
            return "";
          }
          return `![${imgAlt}](${imgUrl})`;
        }
        case "paragraph":
        default:
          // Strip basic HTML tags EditorJS may leave in text
          return (block.data.text || "").replace(/<[^>]+>/g, "");
      }
    })
    .join("\n\n");
}

const EDITOR_HOLDER_ID = "post-create-editorjs";

const PostCreateModal = ({ onClose, onPostCreated }) => {
  const { post: apiPost } = useProtectedApi();
  const editorRef = useRef(null);
  const editorReadyRef = useRef(null); // Promise — resolves when EditorJS is initialised
  const dragCountRef = useRef(0); // counter avoids flickering on child dragenter/leave
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("text");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]); // [{name, pct}]

  // Initialise EditorJS once
  useEffect(() => {
    if (editorRef.current) return;

    const editor = new EditorJS({
      holder: EDITOR_HOLDER_ID,
      placeholder: "Write your post…",
      tools: {
        header: {
          class: Header,
          config: { levels: [2, 3, 4], defaultLevel: 2 },
        },
        list: {
          class: List,
          inlineToolbar: true,
        },
        image: {
          class: ImageTool,
          config: {
            uploader: {
              // Real backend upload — validated before sending
              async uploadByFile(file) {
                return uploadMediaFile(file);
              },
              // URL passthrough (paste a link directly)
              async uploadByUrl(url) {
                return { success: 1, file: { url } };
              },
            },
          },
        },
      },
      minHeight: 120,
    });

    editorRef.current = editor;
    editorReadyRef.current = editor.isReady;

    return () => {
      if (editorRef.current?.destroy) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  // ── Drag-and-drop file insertion ────────────────────────────────────────

  /**
   * Validate, upload, then insert every dropped file as an image block.
   * Automatically switches the post kind to "text" so the editor is visible.
   */
  const insertDroppedFiles = useCallback(async (files) => {
    const mediaFiles = [];
    const errors = [];

    for (const file of files) {
      try {
        validateMediaFile(file); // throws if unsupported or too large
        mediaFiles.push(file);
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (errors.length) setError(errors.join(" "));
    if (!mediaFiles.length) return;

    // Switch to text mode so the editor is rendered
    setKind("text");
    await editorReadyRef.current;

    // Upload files sequentially, tracking progress per file
    for (const file of mediaFiles) {
      setUploadingFiles((prev) => [...prev, { name: file.name, pct: 0 }]);
      try {
        const result = await uploadMediaFile(file, (pct) => {
          setUploadingFiles((prev) =>
            prev.map((f) => (f.name === file.name ? { ...f, pct } : f)),
          );
        });

        editorRef.current?.blocks.insert("image", {
          file: { url: result.file.url },
          caption: file.name,
          withBorder: false,
          stretched: false,
          withBackground: false,
        });
      } catch (err) {
        setError((prev) => (prev ? `${prev} ${err.message}` : err.message));
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      }
    }
  }, []);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current += 1;
    if (dragCountRef.current === 1) setDragOver(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Signal we accept file drops
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setDragOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await insertDroppedFiles(files);
  };

  // ── Form submit ─────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    let bodyMarkdown = "";
    if (kind === "text" && editorRef.current) {
      try {
        const editorData = await editorRef.current.save();
        bodyMarkdown = editorDataToMarkdown(editorData);
      } catch {
        setError("Failed to save editor content.");
        return;
      }
      if (!bodyMarkdown.trim()) {
        setError("Post content cannot be empty.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. Create the post (always starts as draft — status field not writable)
      const payload = {
        title: title.trim(),
        kind,
        ...(kind === "text" ? { body_markdown: bodyMarkdown } : {}),
        ...(kind === "link" ? { link_url: linkUrl.trim() } : {}),
      };

      const created = await apiPost("/posts/", payload);

      // 2. Publish the draft — separate endpoint sets status → published
      const published = await apiPost(`/posts/${created.id}/publish/`, {});

      if (onPostCreated) onPostCreated(published);
      onClose();
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.title?.[0] ||
        err?.response?.data?.body_markdown?.[0] ||
        err?.response?.data?.link_url?.[0] ||
        "Failed to create post. Please try again.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const isUploading = uploadingFiles.length > 0;

  return (
    <div className="pcm-overlay" onClick={onClose}>
      <div
        className={`pcm-modal${dragOver ? " pcm-drag-over" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Full-modal drag-and-drop overlay */}
        {dragOver && (
          <div className="pcm-drop-overlay" aria-hidden="true">
            <span className="pcm-drop-icon">⬇</span>
            <span className="pcm-drop-label">DROP FILES</span>
            <span className="pcm-drop-hint">
              max {MAX_FILE_MB} MB · images &amp; videos
            </span>
          </div>
        )}

        {/* Window chrome */}
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
                {["text", "link"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`pcm-kind-btn${kind === k ? " active" : ""}`}
                    onClick={() => setKind(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor (text) or URL (link) */}
            {kind === "text" ? (
              <div className="pcm-field">
                <label className="pcm-label">
                  Content
                  <span className="pcm-label-hint">
                    — drag &amp; drop images/videos anywhere on this window
                  </span>
                </label>
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

            {/* Per-file upload progress */}
            {isUploading && (
              <div className="pcm-upload-progress" role="status">
                {uploadingFiles.map((f) => (
                  <div key={f.name} className="pcm-upload-row">
                    <span className="pcm-upload-name">↑ {f.name}</span>
                    <div className="pcm-upload-bar-track">
                      <div
                        className="pcm-upload-bar-fill"
                        style={{ width: `${f.pct}%` }}
                      />
                    </div>
                    <span className="pcm-upload-pct">{f.pct}%</span>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="pcm-error">{error}</p>}

            <div className="pcm-actions">
              <button
                type="button"
                className="pcm-cancel-btn"
                onClick={onClose}
                disabled={submitting || isUploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pcm-submit-btn"
                disabled={submitting || isUploading}
              >
                {submitting
                  ? "Publishing…"
                  : isUploading
                    ? "Uploading…"
                    : "Publish"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostCreateModal;
