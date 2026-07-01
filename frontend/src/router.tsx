import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { EventsHubLayout } from "./layouts/EventsHubLayout";
import { BoardTasksPage } from "./pages/BoardTasksPage";
import { AiAssistantPage } from "./pages/AiAssistantPage";
import { AnnouncementEmailPage } from "./pages/AnnouncementEmailPage";
import { EventManagePage } from "./pages/EventManagePage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { EventsPage } from "./pages/EventsPage";
import { FinancePage } from "./pages/FinancePage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MeetingMinutesPage } from "./pages/MeetingMinutesPage";
import { MembersPage } from "./pages/MembersPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PastEventsPage } from "./pages/PastEventsPage";
import { BoardMeetingsPage } from "./pages/BoardMeetingsPage";
import { MeetingDetailPage } from "./pages/MeetingDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { TaskOversightPage } from "./pages/TaskOversightPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
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
        element: <Navigate to="/events/volunteer" replace />,
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
        element: (
          <ProtectedRoute minRole="board">
            <MeetingMinutesPage />
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
          <ProtectedRoute minRole="board">
            <MembersPage />
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
        path: "events",
        element: (
          <ProtectedRoute>
            <EventsHubLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="calendar" replace /> },
          { path: "calendar", element: <EventsPage /> },
          { path: "upcoming", element: <Navigate to="/events/calendar" replace /> },
          { path: "tasks", element: <BoardTasksPage /> },
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
            element: (
              <ProtectedRoute roles={["general"]}>
                <MyTasksPage />
              </ProtectedRoute>
            ),
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
