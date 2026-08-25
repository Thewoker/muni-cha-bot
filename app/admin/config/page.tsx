import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import WhatsAppPanel from "../WhatsAppPanel";

export default async function ConfigPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <main className="admin-main">
      <h1 className="admin-page-title">Configuración</h1>
      <p className="admin-page-subtitle">
        Conectá el número de WhatsApp que va a atender las consultas del
        chatbot.
      </p>
      <div className="admin-card">
        <WhatsAppPanel />
      </div>
    </main>
  );
}
