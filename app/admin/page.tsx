import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "../../lib/admin-auth";
import KanbanBoard from "./KanbanBoard";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <main className="admin-main admin-main-wide">
      <h1 className="admin-page-title">Casos y reclamos</h1>
      <p className="admin-page-subtitle">
        Arrastrá una tarjeta entre columnas para cambiar el estado del caso.
        Al pasar a &quot;Resuelto&quot; se le pregunta al ciudadano si su
        problema quedó solucionado antes de finalizar.
      </p>
      <KanbanBoard />
    </main>
  );
}
