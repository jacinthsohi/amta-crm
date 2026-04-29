import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Strikethrough,
  Code as CodeIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Undo2,
  Redo2,
} from "lucide-react";

/**
 * RichTextEditor — drop-in replacement for <TextArea> with formatting.
 *
 * Storage format: HTML. The component accepts and emits HTML strings via
 * the value/onChange props. Plain-text legacy data is rendered as a single
 * paragraph by Tiptap on first load, so no data migration is required.
 *
 * Toolbar layout: a horizontal row of icon buttons above the editor surface,
 * always visible. The editor surface itself uses the .tiptap-content class
 * defined in src/index.css for typography.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  error,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
  error?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable headings beyond H2/H3; we don't need H1-H6
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-maroon-700 underline hover:text-maroon-800",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Tiptap emits "<p></p>" for empty content; normalize to ""
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: "tiptap-content outline-none",
      },
    },
  });

  // Keep editor in sync if value changes externally (e.g. form reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || "";
    // Avoid loops: only set content if it actually differs
    if (incoming !== current && incoming !== current.replace(/<p><\/p>/g, "")) {
      editor.commands.setContent(incoming, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) {
    return (
      <div
        className={
          "rounded-md border bg-white px-3 py-2 text-sm text-zinc-400 " +
          (error ? "border-red-300" : "border-zinc-200")
        }
        style={{ minHeight: rows * 22 + 16 }}
      >
        Loading editor…
      </div>
    );
  }

  return (
    <div
      className={
        "rounded-md border bg-white overflow-hidden focus-within:ring-1 focus-within:ring-maroon-700 focus-within:border-maroon-700 " +
        (error ? "border-red-300" : "border-zinc-200")
      }
    >
      <Toolbar editor={editor} />
      <div
        className="px-3 py-2 text-sm text-zinc-900"
        style={{ minHeight: rows * 22 }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// =============================================================================
// Toolbar
// =============================================================================

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 px-1 py-1 border-b border-zinc-100 bg-zinc-50/50 flex-wrap">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <BoldIcon size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <ItalicIcon size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <CodeIcon size={13} />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 size={13} />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        <Quote size={13} />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        active={editor.isActive("link")}
        onClick={() => addOrEditLink(editor)}
        title="Link"
      >
        <LinkIcon size={13} />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 size={13} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 size={13} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "inline-flex items-center justify-center w-7 h-7 rounded transition-colors " +
        (disabled
          ? "text-zinc-300 cursor-not-allowed"
          : active
            ? "bg-maroon-50 text-maroon-700"
            : "text-zinc-600 hover:bg-zinc-100")
      }
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-4 bg-zinc-200 mx-0.5" />;
}

/**
 * Prompt for a link URL and apply it to the current selection.
 *
 * If the user selects existing text and clicks the link button, the URL is
 * applied to that selection. If they're already inside a link, this prompts
 * them to update or remove it.
 */
function addOrEditLink(editor: Editor) {
  const previousUrl = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("URL (leave blank to remove):", previousUrl ?? "");

  // Cancelled
  if (url === null) return;

  // Empty → remove the link
  if (url.trim() === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  // Normalize: prepend https:// if no protocol
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized) && !/^mailto:/i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: normalized })
    .run();
}
