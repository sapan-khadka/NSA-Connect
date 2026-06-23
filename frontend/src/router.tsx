import { createBrowserRouter } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { BoardDashboardPage } from "./pages/BoardDashboardPage";
import { EventsPage } from "./pages/EventsPage";
import { FinancePage } from "./pages/FinancePage";
import { GeneralDashboardPage } from "./pages/GeneralDashboardPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MembersPage } from "./pages/MembersPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "member",
        element: (
          <ProtectedRoute roles={["general"]}>
            <GeneralDashboardPage />
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
      { path: "events", element: <EventsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
