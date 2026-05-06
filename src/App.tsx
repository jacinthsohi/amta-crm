import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

import LoginPage from "@/features/auth/LoginPage";
import AcceptInvitationPage from "@/features/auth/AcceptInvitationPage";
import FinishInvitationPage from "@/features/auth/FinishInvitationPage";
import { RequireAuth } from "@/features/auth/RequireAuth";

import PrivacyPage from "@/features/legal/PrivacyPage";
import LandingPage from "@/features/legal/LandingPage";

import { AppLayout } from "@/features/layout/AppLayout";

import DashboardPage from "@/features/dashboard/DashboardPage";
import InvitationsPage from "@/features/admin/InvitationsPage";
import ContactsListPage from "@/features/contacts/ContactsListPage";
import AdminGate from "@/features/admin/AdminGate";
import AccessPage from "@/features/admin/AccessPage";
import ContactDetailPage from "@/features/contacts/ContactDetailPage";
import ProgramsListPage from "@/features/programs/ProgramsListPage";
import ProgramDetailPage from "@/features/programs/ProgramDetailPage";
import CommitteesListPage from "@/features/committees/CommitteesListPage";
import CommitteeDetailPage from "@/features/committees/CommitteeDetailPage";
import EventsListPage from "@/features/events/EventsListPage";
import EventDetailPage from "@/features/events/EventDetailPage";
import ProjectsListPage from "@/features/projects/ProjectsListPage";
import ProjectDetailPage from "@/features/projects/ProjectDetailPage";
import TasksListPage from "@/features/tasks/TasksListPage";
import AskPage from "@/features/ask/AskPage";
import InteractionsListPage from "@/features/interactions/InteractionsListPage";
import InteractionDetailPage from "@/features/interactions/InteractionDetailPage";

/**
 * Root route handler:
 *   - Authenticated users see the dashboard (via AppLayout)
 *   - Unauthenticated users see the public landing page
 *
 * This is the home page URL Google's OAuth verification team checks —
 * it must render meaningful content without requiring sign-in.
 */
function RootRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    // Brief loading state while we determine auth status
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }
  if (!session) {
    return <LandingPage />;
  }
  return (
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <Routes>
            {/* Public root — branches between landing and dashboard */}
            <Route path="/" element={<RootRoute />} />

            {/* Public auth and legal pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route
              path="/accept-invitation/finish"
              element={<FinishInvitationPage />}
            />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* Private — share the AppLayout shell */}
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="contacts" element={<ContactsListPage />} />
              <Route path="contacts/:id" element={<ContactDetailPage />} />
              <Route path="programs" element={<ProgramsListPage />} />
              <Route path="programs/:id" element={<ProgramDetailPage />} />
              <Route path="committees" element={<CommitteesListPage />} />
              <Route path="committees/:id" element={<CommitteeDetailPage />} />
              <Route path="events" element={<EventsListPage />} />
              <Route path="events/:id" element={<EventDetailPage />} />
              <Route path="projects" element={<ProjectsListPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="interactions" element={<InteractionsListPage />} />
              <Route
                path="interactions/:id"
                element={<InteractionDetailPage />}
              />
              <Route path="tasks" element={<TasksListPage />} />
              <Route path="ask" element={<AskPage />} />
              <Route
                path="admin/invitations"
                element={
                  <AdminGate>
                    <InvitationsPage />
                  </AdminGate>
                }
              />
              <Route
                path="admin/access"
                element={
                  <AdminGate>
                    <AccessPage />
                  </AdminGate>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
