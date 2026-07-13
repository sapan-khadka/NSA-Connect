import { Navigate } from "react-router-dom";

/** Legacy board discussion URL — redirected into the two-pane workspace. */
export function BoardDiscussionPage() {
  return <Navigate to="/discussions/board" replace />;
}
