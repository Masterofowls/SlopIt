import { useCallback, useEffect, useRef, useState } from "react";
import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import ImageTool from "@editorjs/image";
import Quote from "@editorjs/quote";
import Code from "@editorjs/code";
import Delimiter from "@editorjs/delimiter";
import Checklist from "@editorjs/checklist";
import InlineCode from "@editorjs/inline-code";
import Marker from "@editorjs/marker";
import {
  uploadMediaFile,
  validateMediaFile,
  MAX_FILE_MB,
} from "../../lib/uploadMedia";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import "./PostCreateModal.css";

const GIPHY_API_KEY =
  import.meta.env.VITE_GIPHY_API_KEY || "whgAeYFKkKMTgtPHXms13jmULWdxN6g7";

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
        case "checklist": {
          const items = block.data.items || [];
          return items
            .map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)
            .join("\n");
        }
        case "quote": {
          const text = (block.data.text || "").replace(/<[^>]+>/g, "");
          const caption = block.data.caption
            ? `\n> — ${block.data.caption}`
            : "";
          return `> ${text}${caption}`;
        }
        case "code":
          return `\`\`\`\n${block.data.code || ""}\n\`\`\``;
        case "delimiter":
          return "---";
        case "image": {
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
          return (block.data.text || "").replace(/<[^>]+>/g, "");
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

const EDITOR_HOLDER_ID = "post-create-editorjs";

const PostCreateModal = ({ onClose, onPostCreated }) => {
  const { post: apiPost } = useProtectedApi();
  const editorRef = useRef(null);
  const editorReadyRef = useRef(null);
  const fileInputRef = useRef(null);
  const gifDebounceRef = useRef(null);

  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  const [postKind, setPostKind] = useState("text");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [alertLevel, setAlertLevel] = useState("info");

  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState(null);


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
        checklist: {
          class: Checklist,
          inlineToolbar: true,
        },
        quote: {
          class: Quote,
          inlineToolbar: true,
        },
        code: {
          class: Code,
        },
        delimiter: {
          class: Delimiter,
        },
        inlineCode: {
          class: InlineCode,
        },
        marker: {
          class: Marker,
        },
        image: {
          class: ImageTool,
          config: {
            uploader: {
              async uploadByFile(file) {
                return uploadMediaFile(file);
              },
              async uploadByUrl(url) {
                return { success: 1, file: { url } };
              },
            },
          },
        },
      },
      minHeight: 160,
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


  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    const errors = [];
    const validFiles = [];
    for (const file of files) {
      try {
        validateMediaFile(file);
        validFiles.push(file);
      } catch (err) {
        errors.push(err.message);
      }
    }
    if (errors.length) setError(errors.join(" "));
    if (!validFiles.length) return;

    await editorReadyRef.current;

    for (const file of validFiles) {
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


  const searchGif = useCallback(async (q) => {
    if (!q.trim()) {
      setGifResults([]);
      return;
    }
    setGifLoading(true);
    setGifError(null);
    try {
      const url = new URL("https://api.giphy.com/v1/gifs/search");
      url.searchParams.set("api_key", GIPHY_API_KEY);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "18");
      url.searchParams.set("rating", "g");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Giphy ${res.status}`);
      const data = await res.json();
      setGifResults(data.data || []);
    } catch {
      setGifError("Search failed. Try again.");
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const handleGifQueryChange = (e) => {
    const val = e.target.value;
    setGifQuery(val);
    clearTimeout(gifDebounceRef.current);
    gifDebounceRef.current = setTimeout(() => searchGif(val), 450);
  };

  const handleGifSelect = useCallback(async (gif) => {
    const gifUrl =
      gif.images?.original?.url ||
      gif.images?.fixed_height?.url ||
      gif.images?.downsized?.url;
    if (!gifUrl) return;
    await editorReadyRef.current;
    editorRef.current?.blocks.insert("image", {
      file: { url: gifUrl },
      caption: "gif",
      withBorder: false,
      stretched: false,
      withBackground: false,
    });
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    let bodyMarkdown = "";
    if (editorRef.current) {
      try {
        const editorData = await editorRef.current.save();
        bodyMarkdown = editorDataToMarkdown(editorData);
      } catch {
        setError("Failed to save editor content.");
        return;
      }
      if (!bodyMarkdown.trim() && postKind !== "poll") {
        setError("Post content cannot be empty.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = { title: title.trim(), kind: postKind };

      if (postKind === "poll") {
        const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (validOptions.length < 2) {
          setError("A poll needs at least 2 options.");
          setSubmitting(false);
          return;
        }
        payload.template_data = {
          options: validOptions.map((text) => ({ text, votes: 0 })),
        };
      } else if (postKind === "alert") {
        payload.template_data = { level: alertLevel };
        payload.body_markdown = bodyMarkdown;
      } else {
        payload.body_markdown = bodyMarkdown;
      }

      const created = await apiPost("/posts/", payload);
      const published = await apiPost(`/posts/${created.id}/publish/`, {});

      if (onPostCreated) onPostCreated(published);
      onClose();
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.title?.[0] ||
        err?.response?.data?.body_markdown?.[0] ||
        "Failed to create post. Please try again.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const isUploading = uploadingFiles.length > 0;

  return (
    <div className="pcm-overlay" onClick={onClose}>
      <div className="pcm-modal" onClick={(e) => e.stopPropagation()}>
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
                placeholder="Post title…"
                maxLength={300}
                autoFocus
              />
            </div>

            <div className="pcm-field">
              <label className="pcm-label">Type</label>
              <div className="pcm-kind-row">
                {[
                  { value: "text", label: "✏️ Text" },
                  { value: "poll", label: "📊 Poll" },
                  { value: "alert", label: "⚠️ Alert" },
                  { value: "news", label: "📰 News" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`pcm-kind-btn${postKind === value ? " pcm-kind-btn--active" : ""}`}
                    onClick={() => setPostKind(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {postKind === "poll" && (
              <div className="pcm-field">
                <label className="pcm-label">Poll Options</label>
                <div className="pcm-poll-options">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="pcm-poll-row">
                      <input
                        className="pcm-input"
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[idx] = e.target.value;
                          setPollOptions(next);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        maxLength={200}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          className="pcm-poll-remove"
                          onClick={() =>
                            setPollOptions(
                              pollOptions.filter((_, i) => i !== idx),
                            )
                          }
                          aria-label="Remove option"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 8 && (
                    <button
                      type="button"
                      className="pcm-file-btn"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                    >
                      + Add option
                    </button>
                  )}
                </div>
              </div>
            )}

            {postKind === "alert" && (
              <div className="pcm-field">
                <label className="pcm-label">Severity</label>
                <div className="pcm-kind-row">
                  {[
                    { value: "info", label: "🟢 Info" },
                    { value: "warn", label: "🟡 Warning" },
                    { value: "danger", label: "🔴 Danger" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`pcm-kind-btn${alertLevel === value ? " pcm-kind-btn--active" : ""}`}
                      onClick={() => setAlertLevel(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {postKind !== "poll" && (
              <div className="pcm-field">
                <label className="pcm-label">Content</label>
                <div id={EDITOR_HOLDER_ID} className="pcm-editor-holder" />
              </div>
            )}

            <div className="pcm-field">
              <label className="pcm-label">Media</label>
              <div className="pcm-media-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="pcm-file-input"
                  onChange={handleFileChange}
                  aria-label="Upload media files"
                />
                <button
                  type="button"
                  className="pcm-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  📎 Attach files
                </button>
                <span className="pcm-file-hint">
                  images &amp; videos · max {MAX_FILE_MB} MB each
                </span>
              </div>

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
            </div>

            <div className="pcm-field">
              <label className="pcm-label" htmlFor="pcm-gif-search">
                GIF
              </label>
              <input
                id="pcm-gif-search"
                className="pcm-gif-search"
                type="search"
                value={gifQuery}
                onChange={handleGifQueryChange}
                placeholder="Search GIFs and click to insert…"
              />
              {gifLoading && <p className="pcm-gif-status">Searching…</p>}
              {gifError && (
                <p className="pcm-gif-status pcm-gif-error">{gifError}</p>
              )}
              {!gifLoading &&
                gifQuery.trim() &&
                gifResults.length === 0 &&
                !gifError && (
                  <p className="pcm-gif-status">No results for "{gifQuery}"</p>
                )}
              {gifResults.length > 0 && (
                <>
                  <div className="pcm-gif-grid">
                    {gifResults.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        className="pcm-gif-thumb"
                        onClick={() => handleGifSelect(gif)}
                        title={gif.title}
                      >
                        <img
                          src={
                            gif.images?.fixed_width_small?.url ||
                            gif.images?.fixed_height_small?.url
                          }
                          alt={gif.title}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                  <p className="pcm-gif-powered">Powered by GIPHY</p>
                </>
              )}
            </div>

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
};;

export default PostCreateModal;
