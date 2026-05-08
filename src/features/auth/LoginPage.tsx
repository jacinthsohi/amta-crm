import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Login page. Supports email/password and Google OAuth.
 *
 * Sign-up is intentionally not offered here — this is an invite-only app.
 * People who haven't been invited yet should not be able to create accounts.
 * Invitees land on /accept-invitation instead.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // If someone tried to visit a protected page and got bounced here, we
  // remember their destination and send them back after login
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate(next, { replace: true });
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // After Google returns the user, send them back to our app at the
        // original destination. Supabase appends the access token to this URL.
        redirectTo: `${window.location.origin}${next}`,
      },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-zinc-50">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <img
            src="/amta-logo.png"
            alt="American Mock Trial Association"
            className="w-16 h-16 mx-auto mb-3"
          />
          <h1 className="text-xl font-semibold text-zinc-900">AMTA CRM</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6">
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-zinc-200 outline-none focus:border-maroon-700 transition-colors"
                  placeholder="you@example.org"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-zinc-200 outline-none focus:border-maroon-700 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600 px-1">
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-maroon-700 hover:bg-maroon-800 disabled:opacity-60 transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-white text-xs text-zinc-400">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p className="text-xs text-center text-zinc-500 mt-5">
          Have an invitation? <Link to="/accept-invitation" className="text-maroon-700 hover:underline">Accept it here</Link>.
        </p>

        <p className="text-[11px] text-center text-zinc-400 mt-6">
          <Link to="/privacy" className="hover:text-zinc-600">
            Privacy policy
          </Link>
          <span className="mx-2">·</span>
          <a
            href="mailto:help@collegemocktrial.org"
            className="hover:text-zinc-600"
          >
            Support
          </a>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
