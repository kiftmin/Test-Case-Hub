import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { getAuthToken, getAuthUser } from "@/lib/auth";

type RequireAuthProps = {
  children: ReactNode;
  /** Redirect here when not authenticated */
  loginPath?: string;
  /** If set, user global role must be one of these (e.g. ADMIN) */
  roles?: Array<"ADMIN" | "AUTHOR" | "USER">;
};

export function RequireAuth({ children, loginPath = "/", roles }: RequireAuthProps) {
  const [, setLocation] = useLocation();
  const token = getAuthToken();
  const user = getAuthUser();

  useEffect(() => {
    if (!token) {
      setLocation(loginPath);
      return;
    }
    if (roles && user && !roles.includes(user.role as "ADMIN" | "AUTHOR" | "USER")) {
      setLocation(loginPath);
    }
  }, [token, user, loginPath, roles, setLocation]);

  if (!token) return null;
  if (roles && user && !roles.includes(user.role as "ADMIN" | "AUTHOR" | "USER")) {
    return null;
  }

  return <>{children}</>;
}
