import type { ReactNode } from "react";
import { isAdminAuthenticated } from "../../lib/admin-auth";
import AdminNav from "./AdminNav";
import "./admin.css";
import LogoutButton from "./LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();

  return (
    <div className="admin-root">
      {authenticated && (
        <header className="admin-header">
          <div className="admin-brand">
            <span className="admin-brand-badge">M</span>
            Panel municipal
          </div>
          <AdminNav />
          <LogoutButton />
        </header>
      )}
      {children}
    </div>
  );
}
