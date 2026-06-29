import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { BoardDashboardPage } from "./pages/BoardDashboardPage";
import { BoardTasksPage } from "./pages/BoardTasksPage";
import { AiAssistantPage } from "./pages/AiAssistantPage";
import { AnnouncementEmailPage } from "./pages/AnnouncementEmailPage";
import { EventManagePage } from "./pages/EventManagePage";
import { EventsPage } from "./pages/EventsPage";
import { FinancePage } from "./pages/FinancePage";
import { UpcomingEventsPage } from "./pages/UpcomingEventsPage";
import { GeneralDashboardPage } from "./pages/GeneralDashboardPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MeetingMinutesPage } from "./pages/MeetingMinutesPage";
import { MembersPage } from "./pages/MembersPage";
import { NotFoundPage } from "./pages/NotFoundPage";
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
        element: (
          <ProtectedRoute roles={["general"]}>
            <GeneralDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "member/tasks",
        element: (
          <ProtectedRoute roles={["general"]}>
            <MyTasksPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "board",
        element: (
          <ProtectedRoute minRole="board">
            <BoardDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "board/tasks",
        element: (
          <ProtectedRoute minRole="board">
            <BoardTasksPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "board/task-oversight",
        element: (
          <ProtectedRoute minRole="board">
            <TaskOversightPage />
          </ProtectedRoute>
        ),
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
            <EventsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "events/upcoming",
        element: (
          <ProtectedRoute>
            <UpcomingEventsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "events/:eventId/manage",
        element: (
          <ProtectedRoute minRole="board">
            <EventManagePage />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
