import { Outlet, Navigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useAuthContext } from "@/contexts/AuthContext";

export function AppLayout() {
  const { user, loading } = useAuthContext();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen min-w-[1280px] bg-background">
      <AppSidebar />
      <TopBar />
      <main className="ml-56 mt-14 p-6">
        <Outlet />
      </main>
    </div>
  );
}
