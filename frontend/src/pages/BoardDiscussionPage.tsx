import { Navigate } from "react-router";

/** Legacy board discussion URL — redirected into the two-pane workspace. */
export function BoardDiscussionPage() {
  return <Navigate to="/discussions/board" replace />;
}
