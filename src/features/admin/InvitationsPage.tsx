import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Loader2, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatError } from "@/lib/errors";

/**
 * Minimal admin invitation surface.
 *
 * For Phase 3 this is intentionally bare-bones:
 *   - Pick a contact who has no auth account yet
 *   - Click "Send invitation"
 *   - We generate a unique token, write a row to `invitations`, and
 *     display the invitation URL the admin can share.
 *
 * Sending the actual email is deferred to Supabase's built-in email feature,
 * which we'll wire later via supabase.auth.admin.inviteUserByEmail. For now,
 * the admin can paste the URL into an email manually — good enough for v1
 * and lets us test the flow end-to-end without configuring SMTP.
 *
 * In Phase 4+ we'll move this into a richer UI tied into the contacts list.
 */
export default function InvitationsPage() {
  const { contact: currentContact } = useAuth();
  const queryClient = useQueryClient();

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull all contacts with no auth account yet (these are the ones eligible to invite)
  const { data: invitableContacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["invitable-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_contacts")
        .select("*")
        .is("auth_user_id", null)
        .not("email", "is", null)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sendInvitation = useMutation({
    mutationFn: async (contactId: string) => {
      setError(null);
      setGeneratedUrl(null);
      const contact = invitableContacts?.find((c) => c.id === contactId);
      if (!contact) throw new Error("Contact not found.");
      if (!contact.email) throw new Error("Contact has no email on file.");

      // Generate a random token
      const token = crypto.randomUUID() + "-" + Math.random().toString(36).slice(2, 10);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // 2-week expiry

      const { error: insertErr } = await supabase
        .from("invitations")
        .insert({
          contact_id: contact.id,
          email: contact.email,
          token,
          invited_by: currentContact?.id ?? null,
          expires_at: expiresAt.toISOString(),
        });
      if (insertErr) throw new Error(insertErr.message);

      const url = `${window.location.origin}/accept-invitation?token=${token}`;
      return url;
    },
    onSuccess: (url) => {
      setGeneratedUrl(url);
      setSelectedContactId(null);
      queryClient.invalidateQueries({ queryKey: ["invitable-contacts"] });
    },
    onError: (e) => {
      setError(formatError(e));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) return;
    sendInvitation.mutate(selectedContactId);
  };

  const copyUrl = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 border-b border-zinc-200">
        <Link
          to="/"
          className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={13} />
          Home
        </Link>
        <span className="text-zinc-300">·</span>
        <span className="text-sm font-semibold text-zinc-900">Invite a user</span>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h1 className="text-base font-semibold text-zinc-900 mb-1">
              Invite a contact
            </h1>
            <p className="text-xs text-zinc-500 mb-5">
              Generate an invitation link for an existing contact who has no
              auth account yet.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                  Contact
                </label>
                <select
                  value={selectedContactId ?? ""}
                  onChange={(e) => setSelectedContactId(e.target.value || null)}
                  required
                  disabled={contactsLoading}
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 outline-none focus:border-maroon-700"
                >
                  <option value="">
                    {contactsLoading ? "Loading…" : "Pick a contact"}
                  </option>
                  {invitableContacts?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} — {c.email}
                    </option>
                  ))}
                </select>
                {invitableContacts?.length === 0 && (
                  <p className="text-xs text-zinc-500 mt-1.5">
                    No invitable contacts yet. Phase 4 will let you create
                    contacts; for now you can add them directly in Supabase's
                    Table Editor.
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 px-1">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedContactId || sendInvitation.isPending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-maroon-700 hover:bg-maroon-800 disabled:opacity-60 transition-colors"
              >
                {sendInvitation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Mail size={14} />
                )}
                Generate invitation link
              </button>
            </form>

            {generatedUrl && (
              <div className="mt-5 p-3 rounded-md bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
                  <CheckCircle2 size={14} />
                  Invitation created
                </div>
                <p className="text-xs text-green-900 leading-relaxed mb-2">
                  Copy this link and send it to the contact. The link is valid
                  for 14 days.
                </p>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white border border-green-200 text-xs font-mono text-zinc-800 break-all">
                  <span className="flex-1">{generatedUrl}</span>
                  <button
                    onClick={copyUrl}
                    className="shrink-0 text-green-700 hover:text-green-900"
                    title="Copy"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
