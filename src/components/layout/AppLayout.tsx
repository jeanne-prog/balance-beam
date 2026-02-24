import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";

export function AppLayout() {
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
