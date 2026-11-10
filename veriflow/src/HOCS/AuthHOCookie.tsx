import { type ComponentType, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { http } from "../api/http/https";

export const withAuth = <P extends object>(
  Component: ComponentType<P>
) => {
  const Wrapper = (props: P) => {
    const { user, isAuthenticated, logout } = useAuthStore();
    const [loading, setLoading] = useState(!user);

    useEffect(() => {
      let isMounted = true;
      const validateSession = async () => {
        try {
          const response = await http.get<any>("/users/users_config/me");
          if (isMounted && response && (response.id || response.email)) {
            useAuthStore.getState().setUser({
              ...response,
              role: response.user_role || response.role || "user",
              user_role: response.user_role || response.role || "user",
              permissions: response.permissions || {},
            });
          } else if (isMounted && !user) {
            logout();
          }
        } catch {
          if (isMounted && !user) {
            logout();
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      validateSession();

      return () => {
        isMounted = false;
      };
    }, []);

    if (loading) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#07111D" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ width: 36, height: 36, border: "4px solid #3B82F6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ color: "#94A3B8", fontSize: "14px", fontFamily: "sans-serif" }}>Verifying session...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated || !user) {
      return <Navigate to="/login" replace />;
    }

    return <Component {...props} />;
  };

  Wrapper.displayName = "withAuth(" + (Component.displayName || Component.name || "Component") + ")";
  return Wrapper;
};

export const hocComponent = withAuth;
