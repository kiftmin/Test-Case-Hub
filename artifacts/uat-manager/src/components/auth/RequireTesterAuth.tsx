import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { getAuthToken, getAuthUser } from "@/lib/auth";

export function RequireTesterAuth({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const token = getAuthToken();
  const user = getAuthUser();

  useEffect(() => {
    if (!token) {
      setLocation("/tester");
    }
  }, [token, setLocation]);

  if (!token || !user) return null;

  return <>{children}</>;
}
