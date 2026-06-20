import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout";
import { EventsPage } from "./pages/EventsPage";
import { FinancePage } from "./pages/FinancePage";
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
      { path: "members", element: <MembersPage /> },
      { path: "events", element: <EventsPage /> },
      { path: "finance", element: <FinancePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
