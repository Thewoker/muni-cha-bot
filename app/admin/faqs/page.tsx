import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import FaqsManager from "../FaqsManager";

export default async function FaqsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <main className="admin-main">
      <h1 className="admin-page-title">Preguntas frecuentes</h1>
      <p className="admin-page-subtitle">
        Base de conocimiento que el chatbot usa para responder consultas por
        chat y WhatsApp.
      </p>
      <div className="admin-card">
        <FaqsManager />
      </div>
    </main>
  );
}
