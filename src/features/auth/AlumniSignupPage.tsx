import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Program } from "@/lib/database.types";

/**
 * Public alumni signup form (no auth required).
 *
 * Alumni who weren't seeded into the CRM can request a contact record here.
 * Submissions land in `alumni_claims` for admin review. Approval converts
 * the claim into a real `contacts` row (handled separately, not here).
 *
 * Discoverability: this page is intentionally NOT linked from the landing
 * page. The URL is shared via email to specific alumni.
 *
 * Anti-spam: a honeypot field named `website` is included as a hidden input.
 * Bots that auto-fill every form field will fill it; humans won't see it.
 * Submissions with a non-empty honeypot are silently dropped.
 *
 * Signed-in user handling: the alumni_claims INSERT policy applies only to
 * the `anon` role. If a signed-in admin lands on this page, the policy will
 * reject their submission with a 403. Rather than loosening the policy (and
 * encouraging admins to use this form when they should be using /contacts),
 * we detect auth here and show a redirect message with an option to sign out
 * and continue if they really do want to submit the form for someone else.
 */
export default function AlumniSignupPage() {
  const { session, signOut } = useAuth();

  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programError, setProgramError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [programId, setProgramId] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  // Honeypot field (see comment above; not rendered as a real input)
  const [website, setWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load programs for the dropdown. Skip the fetch when signed in — we're
  // rendering the signed-in redirect view instead and don't need the list.
  useEffect(() => {
    if (session) {
      setLoadingPrograms(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("active_programs")
          .select("id, name, short_name")
          .order("name");
        if (cancelled) return;
        if (error) {
          setProgramError(
            "Couldn't load the program list. Please refresh and try again.",
          );
          console.error("Failed to load programs:", error);
        } else {
          setPrograms((data ?? []) as Program[]);
        }
      } finally {
        if (!cancelled) setLoadingPrograms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // -----------------------------------------------------------------------
  // Signed-in redirect view
  // -----------------------------------------------------------------------
  if (session) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-lg border border-zinc-200 p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">
            You're already signed in
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            This form is for alumni who don't yet have a CRM account. As an
            admin, the fastest way to add someone new is the contacts page —
            you can create their record directly without going through the
            review queue.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/contacts"
              className="block w-full rounded-md bg-maroon-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-maroon-800"
            >
              Go to contacts
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut();
              }}
              className="block w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Sign out and use this form
            </button>
            <Link
              to="/"
              className="mt-2 block text-center text-xs text-zinc-500 hover:text-zinc-700"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const minYear = 1985; // AMTA founding
  const maxYear = currentYear + 5; // give current students room to estimate

  function validate(): string | null {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!email.trim()) return "Email is required.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      return "Please enter a valid email address.";
    if (
      secondaryEmail.trim() &&
      !/^\S+@\S+\.\S+$/.test(secondaryEmail.trim())
    )
      return "Please enter a valid secondary email address (or leave it blank).";
    if (!graduationYear) return "Graduation year is required.";
    const yr = Number(graduationYear);
    if (!Number.isInteger(yr) || yr < minYear || yr > maxYear)
      return `Graduation year must be between ${minYear} and ${maxYear}.`;
    if (!programId) return "Please select your program.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Silent honeypot drop: pretend success without writing anything.
    if (website.trim()) {
      console.warn("Honeypot triggered; discarding submission.");
      setSubmitted(true);
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("alumni_claims").insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        secondary_email: secondaryEmail.trim().toLowerCase() || null,
        graduation_year: Number(graduationYear),
        program_id: programId,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        status: "pending",
      });
      if (error) {
        console.error("Failed to submit alumni claim:", error);
        setError(
          "Something went wrong submitting your claim. Please try again, or email us if it keeps failing.",
        );
      } else {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-lg border border-zinc-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <img src="/amta-logo.png" alt="AMTA" className="w-10 h-10" />
            <div>
              <div className="text-sm font-semibold text-zinc-900">AMTA</div>
              <div className="text-xs text-zinc-500">Alumni signup</div>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">
            Thanks for reaching out!
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            We received your information and an AMTA admin will review your
            claim soon. You'll hear back from us once it's approved.
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed mt-3">
            If you submitted in error or want to update something, just reply
            to the email you got from us.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="max-w-xl mx-auto">
        {/* Brand header */}
        <div className="flex items-center gap-2.5 mb-6">
          <img src="/amta-logo.png" alt="AMTA" className="w-10 h-10" />
          <div>
            <div className="text-sm font-semibold text-zinc-900">AMTA</div>
            <div className="text-xs text-zinc-500">Alumni signup</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">
            Request your alumni profile
          </h1>
          <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
            Fill out the form below and an AMTA admin will review your
            request. Once approved, your information will be added to our
            alumni directory.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — visually hidden but in the DOM */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-10000px",
                width: "1px",
                height: "1px",
                overflow: "hidden",
              }}
            >
              <label>
                Website (leave blank)
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" required>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="form-input"
                  autoComplete="given-name"
                  required
                />
              </FormField>
              <FormField label="Last name" required>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="form-input"
                  autoComplete="family-name"
                  required
                />
              </FormField>
            </div>

            <FormField label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                autoComplete="email"
                required
              />
            </FormField>

            <FormField
              label="Secondary email (optional)"
              hint="If you have a personal email in addition to a school email (or vice versa), we'll keep both on file. We may use either to reach you."
            >
              <input
                type="email"
                value={secondaryEmail}
                onChange={(e) => setSecondaryEmail(e.target.value)}
                className="form-input"
                autoComplete="email"
              />
            </FormField>

            <FormField label="Graduation year" required>
              <input
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                placeholder={String(currentYear)}
                min={minYear}
                max={maxYear}
                className="form-input"
                required
              />
            </FormField>

            <FormField label="Program (school)" required>
              {loadingPrograms ? (
                <div className="text-xs text-zinc-500 py-2">
                  Loading program list…
                </div>
              ) : programError ? (
                <div className="text-xs text-red-600 py-2">{programError}</div>
              ) : (
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">Select your school…</option>
                  {(programs ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-zinc-500 mt-1">
                Don't see your school? Email us — we may need to add it first.
              </p>
            </FormField>

            <FormField label="Phone (optional)">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                autoComplete="tel"
              />
            </FormField>

            <FormField label="Anything else we should know? (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="form-input resize-none"
                placeholder="Coaching roles, board service, etc."
              />
            </FormField>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loadingPrograms}
              className="w-full bg-maroon-700 text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-maroon-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting…" : "Submit request"}
            </button>

            <p className="text-[11px] text-zinc-500 text-center">
              By submitting, you agree we may contact you about your AMTA
              alumni status.
            </p>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-zinc-500 hover:text-maroon-700">
            ← Back to home
          </Link>
        </div>
      </div>

      {/* Local styles for the form inputs to keep the JSX tidy */}
      <style>{`
        .form-input {
          display: block;
          width: 100%;
          padding: 0.5rem 0.625rem;
          font-size: 0.875rem;
          color: #18181b;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 0.375rem;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .form-input:focus {
          border-color: #70172a;
          box-shadow: 0 0 0 2px rgba(112, 23, 42, 0.12);
        }
      `}</style>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-700 mb-1">
        {label}
        {required && <span className="text-maroon-700 ml-0.5">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{hint}</p>
      )}
    </label>
  );
}
