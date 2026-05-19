import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link2, Copy, Mail, Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Profile self-service action: generates a magic-link URL the contact can
 * use to edit their own profile. Lives in the sidebar of the admin
 * ContactDetailPage as a compact action — it's used rarely (admin onboards
 * a contact, contact lost their email, etc.), and the people clicking it
 * already know what it does, so we keep the surface area minimal.
 *
 * Each click revokes any prior active tokens for the contact and issues
 * a fresh one (handled server-side by create_profile_token, see Chunk 5
 * migration). The result modal lets the admin copy the URL or hand it off
 * to their default email client.
 */
export function ProfileLinkSection({
  contactId,
  contactFirstName,
  contactEmail,
}: {
  contactId: string;
  contactFirstName: string;
  contactEmail: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("create_profile_token", {
        p_contact_id: contactId,
      });
      if (error) throw error;
      if (!data) throw new Error("Token creation returned no data");
      return `${window.location.origin}/profile?token=${data}`;
    },
    onSuccess: (url) => {
      setGeneratedUrl(url);
      setModalOpen(true);
    },
  });

  return (
    <>
      <div>
        <h3 className="text-[11px] font-semibold tracking-wide uppercase text-zinc-500 mb-2.5">
          Profile self-service
        </h3>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <Link2 size={12} />
          {generate.isPending ? "Generating…" : "Generate magic link"}
        </button>
        {generate.error && (
          <div className="mt-2 text-xs text-red-700">
            {generate.error.message}
          </div>
        )}
      </div>

      {modalOpen && generatedUrl && (
        <LinkModal
          url={generatedUrl}
          contactFirstName={contactFirstName}
          contactEmail={contactEmail}
          onClose={() => {
            setModalOpen(false);
            setGeneratedUrl(null);
          }}
        />
      )}
    </>
  );
}

function LinkModal({
  url,
  contactFirstName,
  contactEmail,
  onClose,
}: {
  url: string;
  contactFirstName: string;
  contactEmail: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // navigator.clipboard can fail in non-HTTPS contexts; fall back to
      // a select-and-prompt-user approach. Should never happen on
      // crm.mocktrial.tech (HTTPS) but defensive.
      window.prompt("Copy this link:", url);
    }
  }

  function handleCompose() {
    const subject = encodeURIComponent("Your AMTA profile link");
    const body = encodeURIComponent(
      `Hi ${contactFirstName},

Here's a personal link you can use to update your contact info on file with AMTA:

${url}

The link is good for 30 days and refreshes whenever you save changes. Just click it (no password needed) and you'll be able to update your name, pronouns, phone, and other details directly.

Let me know if you have any trouble!

— AMTA`,
    );
    const mailto = contactEmail
      ? `mailto:${contactEmail}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailto;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Magic link ready
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Share this link with {contactFirstName}. It expires in 30 days
              and any previous links have been disabled.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* URL display + copy */}
        <div className="mb-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Profile link
          </label>
          <div className="mt-1.5 flex items-stretch gap-2">
            <input
              type="text"
              value={url}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                copied
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {copied ? (
                <>
                  <Check size={13} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={13} />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Done
          </button>
          <button
            onClick={handleCompose}
            className="flex items-center justify-center gap-1.5 rounded-md bg-maroon-700 px-4 py-2 text-sm font-medium text-white hover:bg-maroon-800"
          >
            <Mail size={14} />
            Compose email
          </button>
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          Tip: the "Compose email" button opens a draft in your default mail
          app. You can edit it before sending.
        </p>
      </div>
    </div>
  );
}
