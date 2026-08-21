import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import {
  getDashboardPath,
  memberSatisfiesMinRole,
  type MemberRole,
} from "../lib/roles";

type ProtectedRouteProps = {
  children: ReactNode;
  minRole?: MemberRole;
  roles?: MemberRole[];
  allow?: (member: MemberResponse) => boolean;
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
  allow,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, member } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingState />;
  }

  if (!isAuthenticated || !member) {
    const redirectTarget = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from: redirectTarget }} />;
  }

  if (roles && !roles.includes(member.role)) {
    return <Navigate to={getDashboardPath(member.role)} replace />;
  }

  if (minRole && !memberSatisfiesMinRole(member, minRole)) {
    return <Navigate to={getDashboardPath(member.role)} replace />;
  }

  if (allow && !allow(member)) {
    return <Navigate to={getDashboardPath(member.role)} replace />;
  }

  return children;
}
