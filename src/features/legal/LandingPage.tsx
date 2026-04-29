import { Link } from "react-router-dom";
import { Users, Calendar, Briefcase, FolderKanban, MessagesSquare } from "lucide-react";

/**
 * Public landing page shown at "/" to unauthenticated visitors.
 *
 * Purpose:
 *   1. Tell visitors what AMTA CRM is so they can decide whether to sign in
 *   2. Provide a clear sign-in entry point
 *   3. Surface the privacy policy and support email
 *   4. Satisfy Google OAuth verification requirement that the home page URL
 *      is publicly accessible (not behind a login wall)
 *
 * Authenticated users never see this — App.tsx routes them straight to
 * the dashboard. So we can be honest here that the app is invitation-only.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-maroon-50 border border-maroon-100">
              <span className="text-maroon-700 text-sm font-bold">A</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900 leading-tight">AMTA CRM</div>
              <div className="text-[11px] text-zinc-500 leading-tight">Internal tool</div>
            </div>
          </div>
          <Link
            to="/login"
            className="text-sm px-3 py-1.5 rounded-md font-medium bg-maroon-700 text-white hover:bg-maroon-800 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 mb-4">
            The internal CRM for the American Mock Trial Association.
          </h1>
          <p className="text-lg text-zinc-600 leading-relaxed">
            A purpose-built tool for AMTA's board of directors, officers,
            and committee members to manage contacts, programs, tournaments,
            projects, and the day-to-day work of running the organization.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-maroon-700 text-white hover:bg-maroon-800 transition-colors"
            >
              Sign in to AMTA CRM
            </Link>
            <span className="text-sm text-zinc-500">
              Access by invitation only
            </span>
          </div>
        </div>

        {/* What's inside */}
        <div className="mt-20">
          <h2 className="text-base font-semibold text-zinc-900 mb-5">
            What's inside
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Users size={16} className="text-maroon-700" />}
              title="Contacts and member institutions"
              description="A unified directory of board members, officers, committee members, and program contacts."
            />
            <FeatureCard
              icon={<Briefcase size={16} className="text-maroon-700" />}
              title="Committees and board terms"
              description="Track who serves on which committee, current and historical board service, and officer terms."
            />
            <FeatureCard
              icon={<Calendar size={16} className="text-maroon-700" />}
              title="Tournaments and meetings"
              description="Plan and document tournaments and board meetings with hosts, staffing, and supporting documents."
            />
            <FeatureCard
              icon={<FolderKanban size={16} className="text-maroon-700" />}
              title="Projects and tasks"
              description="Coordinate the initiatives the board is driving — with owners, deadlines, and status."
            />
            <FeatureCard
              icon={<MessagesSquare size={16} className="text-maroon-700" />}
              title="Interactions and notes"
              description="Log meetings, calls, emails, and notes — and link them to the people, committees, and projects involved."
            />
          </div>
        </div>

        {/* About */}
        <div className="mt-20 max-w-2xl text-sm text-zinc-600 leading-relaxed">
          <h2 className="text-base font-semibold text-zinc-900 mb-3">
            About this tool
          </h2>
          <p>
            AMTA CRM is operated by and for the American Mock Trial
            Association — the national governing body for college mock
            trial in the United States. It is not a public application;
            access is granted to AMTA volunteers by invitation only.
          </p>
          <p className="mt-3">
            Questions, support requests, or invitation requests should be
            directed to{" "}
            <a
              href="mailto:help@collegemocktrial.org"
              className="text-maroon-700 hover:underline"
            >
              help@collegemocktrial.org
            </a>
            .
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-zinc-500">
          <div>
            American Mock Trial Association ·{" "}
            <a
              href="https://collegemocktrial.org"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-700"
            >
              collegemocktrial.org
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-zinc-700">
              Privacy policy
            </Link>
            <a
              href="mailto:help@collegemocktrial.org"
              className="hover:text-zinc-700"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-maroon-50 border border-maroon-100">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      </div>
      <p className="text-xs text-zinc-600 leading-relaxed">{description}</p>
    </div>
  );
}
