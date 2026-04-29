import { Link } from "react-router-dom";

/**
 * Public privacy policy page. Required for Google OAuth verification and
 * good practice regardless. Lives at /privacy and is accessible without
 * authentication so Google's reviewers can read it.
 *
 * Tailored to AMTA's specific use: an internal-only CRM accessed by board
 * members and committee members on invitation only. We don't sell data,
 * we don't track users with cookies beyond auth, we don't share with
 * third parties.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link
            to="/login"
            className="text-sm text-maroon-700 hover:underline"
          >
            ← Back to AMTA CRM
          </Link>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-zinc-500 mb-8">
          AMTA CRM · Last updated April 28, 2026
        </p>

        <div className="space-y-6 text-sm text-zinc-700 leading-relaxed">
          <Section title="Who we are">
            <p>
              AMTA CRM is an internal tool operated by the American Mock Trial
              Association ("AMTA") for use by AMTA's board of directors,
              officers, committee members, and other authorized AMTA
              volunteers. The application is not available to the public —
              access is by invitation only.
            </p>
          </Section>

          <Section title="What we collect">
            <p>
              When you sign in to AMTA CRM, we collect and store:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Your name and email address from your Google account, used
                to identify you within the application
              </li>
              <li>
                A Google authentication token used to keep you signed in
              </li>
              <li>
                Information you choose to enter into the CRM, such as
                contacts, meeting notes, project information, and similar
                organizational records
              </li>
            </ul>
            <p className="mt-3">
              We do not collect any data from your Google account beyond
              your basic profile information (name, email, profile picture).
              We do not access your Gmail, Google Drive, Calendar, or any
              other Google services.
            </p>
          </Section>

          <Section title="How we use your information">
            <p>
              The information stored in AMTA CRM is used solely to support
              AMTA's organizational activities, including:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Maintaining records of AMTA contacts, member institutions,
                committees, events, projects, and tasks
              </li>
              <li>
                Coordinating communications and activities among AMTA
                volunteers
              </li>
              <li>
                Tracking the history of AMTA's organizational decisions and
                projects
              </li>
            </ul>
          </Section>

          <Section title="How we share your information">
            <p>
              We do not sell, rent, or share your information with third
              parties. Information stored in AMTA CRM is visible only to
              authorized AMTA users who have been invited to access the
              system.
            </p>
            <p className="mt-3">
              We use the following service providers to operate AMTA CRM:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Vercel</strong> — hosts the AMTA CRM website
              </li>
              <li>
                <strong>Supabase</strong> — provides the database and
                authentication infrastructure
              </li>
              <li>
                <strong>Google</strong> — provides authentication via Sign
                in with Google
              </li>
            </ul>
            <p className="mt-3">
              These providers process data on AMTA's behalf under their own
              privacy policies and terms of service. We do not authorize
              them to use your information for any other purpose.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              We retain information in AMTA CRM for as long as it is useful
              to AMTA's operations. AMTA maintains long-term organizational
              records (such as the history of board members and committee
              service) as part of its institutional memory. If you would
              like records about you removed, contact us at the email
              address below.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can request access to, correction of, or deletion of any
              personal information we hold about you by contacting us at
              the email below. You can revoke AMTA CRM's access to your
              Google account at any time at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="text-maroon-700 underline hover:text-maroon-800"
              >
                myaccount.google.com/permissions
              </a>
              .
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use industry-standard practices to protect the information
              stored in AMTA CRM, including encrypted connections, database
              row-level security, and invitation-only access. However, no
              system is perfectly secure — if you become aware of any
              security concern, please contact us immediately.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If we make material changes to this privacy policy, we will
              update the "Last updated" date at the top and notify users
              via the application.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this privacy policy or about how AMTA handles
              your data? Contact us at:
            </p>
            <p className="mt-2">
              <a
                href="mailto:help@collegemocktrial.org"
                className="text-maroon-700 underline hover:text-maroon-800"
              >
                help@collegemocktrial.org
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-200 text-xs text-zinc-500">
          American Mock Trial Association · collegemocktrial.org
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-zinc-900 mb-2">{title}</h2>
      {children}
    </div>
  );
}
