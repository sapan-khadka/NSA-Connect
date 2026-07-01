import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import {
  getDashboardPath,
  isRoleAtLeast,
  type MemberRole,
} from "../lib/roles";

type ProtectedRouteProps = {
  children: ReactNode;
  minRole?: MemberRole;
  roles?: MemberRole[];
};

function AuthLoadingState() {
  return (
    <div className="py-16 text-center text-label">Checking your session...</div>
  );
}

export function ProtectedRoute({
  children,
  minRole,
  roles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, member } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingState />;
  }

  if (!isAuthenticated || !member) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(member.role)) {
    return <Navigate to={getDashboardPath(member.role)} replace />;
  }

  if (minRole && !isRoleAtLeast(member.role, minRole)) {
    return <Navigate to={getDashboardPath(member.role)} replace />;
  }

  return children;
}
