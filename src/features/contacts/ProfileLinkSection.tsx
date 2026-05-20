import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link2, Copy, Mail, Check, X, Send, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Profile self-service actions for the admin ContactDetailPage sidebar.
 *
 * Two buttons, two distinct flows:
 *   1. "Generate link" — opens a modal showing the URL with a copy button
 *      and a "Compose email" mailto fallback. For when the admin wants to
 *      hand off the link themselves (or SendGrid is down).
 *   2. "Email link directly" — no modal; calls /api/send-magic-link, which
 *      mints a fresh token server-side and emails it to the contact via
 *      SendGrid. One click, done.
 *
 * Both ultimately mint a token via the same DB logic (_mint_profile_token);
 * each click revokes the contact's prior active token.
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

  // ---- Flow 1: generate a link and open the modal --------------------------
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

  // ---- Flow 2: email the link directly via the server ----------------------
  const emailDirect = useMutation({
    mutationFn: async (): Promise<string> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not signed in. Please refresh the page.");
      }

      const res = await fetch(`/api/send-magic-link?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contact_id: contactId }),
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg = errJson.error;
        } catch {
          // Response wasn't JSON; keep the generic message.
        }
        throw new Error(msg);
      }

      const body = (await res.json()) as { sent_to?: string };
      return body.sent_to ?? contactEmail ?? "the contact";
    },
  });

  // Auto-clear the "sent" confirmation after a few seconds so the button
  // returns to its normal state.
  function handleEmailDirect() {
    emailDirect.mutate(undefined, {
      onSuccess: () => {
        setTimeout(() => emailDirect.reset(), 5000);
      },
    });
  }

  const noEmail = !contactEmail;

  return (
    <>
      <div>
        <h3 className="text-[11px] font-semibold tracking-wide uppercase text-zinc-500 mb-2.5">
          Profile self-service
        </h3>

        <div className="flex flex-col gap-2">
          {/* Flow 1: generate + modal */}
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <Link2 size={12} />
            {generate.isPending ? "Generating…" : "Generate link"}
          </button>

          {/* Flow 2: email directly */}
          <button
            onClick={handleEmailDirect}
            disabled={emailDirect.isPending || noEmail}
            title={
              noEmail
                ? "This contact has no email address on file"
                : `Email a magic link to ${contactFirstName}`
            }
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
              emailDirect.isSuccess
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {emailDirect.isSuccess ? (
              <>
                <Check size={12} />
                Emailed
              </>
            ) : emailDirect.isPending ? (
              <>
                <Send size={12} />
                Sending…
              </>
            ) : (
              <>
                <Send size={12} />
                Email link directly
              </>
            )}
          </button>
        </div>

        {/* Inline status messaging below the buttons */}
        {noEmail && (
          <div className="mt-2 text-xs text-zinc-400">
            No email on file — add one to email a link.
          </div>
        )}
        {generate.error && (
          <div className="mt-2 text-xs text-red-700">
            {generate.error.message}
          </div>
        )}
        {emailDirect.isSuccess && (
          <div className="mt-2 text-xs text-emerald-700">
            Link emailed to {emailDirect.data}.
          </div>
        )}
        {emailDirect.error && (
          <div className="mt-2 flex items-start gap-1 text-xs text-red-700">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{emailDirect.error.message}</span>
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
          app. You can edit it before sending. To have AMTA send the email
          for you instead, use "Email link directly" on the contact page.
        </p>
      </div>
    </div>
  );
}
