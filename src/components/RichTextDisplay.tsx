import { useMemo } from "react";
import DOMPurify from "dompurify";

/**
 * RichTextDisplay — read-only renderer for HTML stored by RichTextEditor.
 *
 * Sanitizes the HTML with DOMPurify before injecting via dangerouslySetInnerHTML
 * to prevent XSS from any user-controlled content.
 *
 * Plain-text legacy values (no HTML tags) render fine — the sanitizer leaves
 * them untouched, and the .tiptap-content typography rules kick in via the
 * wrapper div.
 *
 * Returns null if the content is empty so callers can use it directly without
 * wrapper conditionals.
 */
export function RichTextDisplay({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const safe = useMemo(() => {
    if (!html) return "";
    // Configure DOMPurify to allow the tags Tiptap emits + safe link targets.
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "s",
        "code",
        "pre",
        "h2",
        "h3",
        "ul",
        "ol",
        "li",
        "blockquote",
        "a",
      ],
      ALLOWED_ATTR: ["href", "rel", "target", "class"],
      // Force external links to open in a new tab + add safety rel
      ADD_ATTR: ["target", "rel"],
    });
  }, [html]);

  if (!safe || safe.trim() === "") return null;

  return (
    <div
      className={`tiptap-content ${className ?? ""}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
