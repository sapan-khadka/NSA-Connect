import {
  createBrowserRouter,
  Navigate,
  useParams,
  type RouteObject,
} from "react-router";

function LegacyPhotoAlbumRedirect() {
  const { eventId } = useParams();
  return <Navigate to={`/events/media/${eventId ?? ""}`} replace />;
}

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { EventsHubLayout } from "./layouts/EventsHubLayout";
import { SettingsLayout } from "./layouts/SettingsLayout";
import { BoardDiscussionPage } from "./pages/BoardDiscussionPage";
import { BoardTasksPage } from "./pages/BoardTasksPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { AiAssistantPage } from "./pages/AiAssistantPage";
import { AnnouncementEmailPage } from "./pages/AnnouncementEmailPage";
import { DiscussionsPage } from "./pages/DiscussionsPage";
import { EventCheckInPage } from "./pages/EventCheckInPage";
import { EventManagePage } from "./pages/EventManagePage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { EventPhotoAlbumPage } from "./pages/EventPhotoAlbumPage";
import { EventSuggestionsPage } from "./pages/EventSuggestionsPage";
import { IdeaWorkspacePage } from "./pages/IdeaWorkspacePage";
import { EventsPage } from "./pages/EventsPage";
import { FinancePage } from "./pages/FinancePage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MemberProfilePage } from "./pages/MemberProfilePage";
import { MembersPage } from "./pages/MembersPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PastEventsPage } from "./pages/PastEventsPage";
import { BoardMeetingsPage } from "./pages/BoardMeetingsPage";
import { MeetingDetailPage } from "./pages/MeetingDetailPage";
import { CustomMediaAlbumPage } from "./pages/CustomMediaAlbumPage";
import { PhotoArchivePage } from "./pages/PhotoArchivePage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsEmailPage } from "./pages/settings/SettingsEmailPage";
import { SettingsNotificationsPage } from "./pages/settings/SettingsNotificationsPage";
import { SettingsPrivacyPage } from "./pages/settings/SettingsPrivacyPage";
import { SettingsProfilePage } from "./pages/settings/SettingsProfilePage";
import { SettingsSecurityPage } from "./pages/settings/SettingsSecurityPage";
import { PublicEventPage } from "./pages/PublicEventPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TaskOversightPage } from "./pages/TaskOversightPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "announcements",
        element: (
          <ProtectedRoute>
            <AnnouncementsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "notifications",
        element: (
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: null },
          { path: "profile", element: <SettingsProfilePage /> },
          { path: "notifications", element: <SettingsNotificationsPage /> },
          { path: "security", element: <SettingsSecurityPage /> },
          { path: "privacy", element: <SettingsPrivacyPage /> },
          { path: "email", element: <SettingsEmailPage /> },
        ],
      },
      {
        path: "assistant",
        element: (
          <ProtectedRoute>
            <AiAssistantPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "member",
        element: <Navigate to="/" replace />,
      },
      {
        path: "member/tasks",
        element: <Navigate to="/events/tasks" replace />,
      },
      {
        path: "board",
        element: <Navigate to="/" replace />,
      },
      {
        path: "tasks",
        element: <Navigate to="/events/tasks" replace />,
      },
      {
        path: "board/tasks",
        element: <Navigate to="/events/tasks" replace />,
      },
      {
        path: "board/task-oversight",
        element: <Navigate to="/events/oversight" replace />,
      },
      {
        path: "board/meeting-minutes",
        element: <Navigate to="/events/meetings" replace />,
      },
      {
        path: "discussions",
        element: (
          <ProtectedRoute>
            <DiscussionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "discussions/board",
        element: (
          <ProtectedRoute>
            <DiscussionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "discussions/event/:eventId",
        element: (
          <ProtectedRoute>
            <DiscussionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "discussions/room/:roomId",
        element: (
          <ProtectedRoute>
            <DiscussionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "board/discussion",
        element: (
          <ProtectedRoute minRole="board">
            <BoardDiscussionPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "board/announcement-email",
        element: (
          <ProtectedRoute minRole="board">
            <AnnouncementEmailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "members",
        element: (
          <ProtectedRoute>
            <MembersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "members/:memberId",
        element: (
          <ProtectedRoute>
            <MemberProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports/:reportId",
        element: (
          <ProtectedRoute>
            <ReportDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "finance",
        element: (
          <ProtectedRoute minRole="board">
            <FinancePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "events/:eventId/checkin",
        element: <EventCheckInPage />,
      },
      {
        path: "e/:eventId",
        element: <PublicEventPage />,
      },
      {
        path: "events",
        element: (
          <ProtectedRoute>
            <EventsHubLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="calendar" replace /> },
          { path: "calendar", element: <EventsPage /> },
          { path: "ideas", element: <EventSuggestionsPage /> },
          { path: "ideas/:ideaId", element: <IdeaWorkspacePage /> },
          {
            path: "suggestions",
            element: <Navigate to="/events/ideas" replace />,
          },
          { path: "upcoming", element: <Navigate to="/events/calendar" replace /> },
          { path: "tasks", element: <BoardTasksPage /> },
          { path: "media", element: <PhotoArchivePage /> },
          {
            path: "media/album/:albumId",
            element: <CustomMediaAlbumPage />,
          },
          { path: "media/:eventId", element: <EventPhotoAlbumPage /> },
          { path: "photos", element: <Navigate to="/events/media" replace /> },
          {
            path: "photos/:eventId",
            element: <LegacyPhotoAlbumRedirect />,
          },
          {
            path: "past",
            element: (
              <ProtectedRoute minRole="board">
                <PastEventsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "meetings",
            element: (
              <ProtectedRoute minRole="board">
                <BoardMeetingsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "meetings/:eventId",
            element: (
              <ProtectedRoute minRole="board">
                <MeetingDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "oversight",
            element: (
              <ProtectedRoute minRole="board">
                <TaskOversightPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "volunteer",
            element: <Navigate to="/events/tasks" replace />,
          },
          {
            path: ":eventId/manage",
            element: (
              <ProtectedRoute minRole="board">
                <EventManagePage />
              </ProtectedRoute>
            ),
          },
          {
            path: ":eventId",
            element: <EventDetailPage />,
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
