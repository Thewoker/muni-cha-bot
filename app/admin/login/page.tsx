"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import "../admin.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Clave incorrecta.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <p className="login-title">Panel municipal</p>
        <p className="login-subtitle">Ingresá la clave de administración</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Clave"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
