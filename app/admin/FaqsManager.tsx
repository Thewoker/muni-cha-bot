"use client";

import { useEffect, useState } from "react";

interface FaqRecord {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  createdAt: string;
}

interface FaqFormState {
  question: string;
  answer: string;
  category: string;
  keywords: string;
}

const EMPTY_FORM: FaqFormState = {
  question: "",
  answer: "",
  category: "",
  keywords: "",
};

function keywordsToArray(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

export default function FaqsManager() {
  const [faqs, setFaqs] = useState<FaqRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/faqs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) setFaqs(data.faqs);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(faq: FaqRecord) {
    setEditingId(faq.id);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      keywords: faq.keywords.join(", "),
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim()) {
      setFormError("Completá pregunta, respuesta y categoría.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category.trim(),
      keywords: keywordsToArray(form.keywords),
    };

    const res = await fetch(
      editingId ? `/api/admin/faqs/${editingId}` : "/api/admin/faqs",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setFormError(data?.error ?? "No se pudo guardar.");
      return;
    }

    setModalOpen(false);
    setRefreshToken((n) => n + 1);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta pregunta frecuente?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) setRefreshToken((n) => n + 1);
  }

  return (
    <div>
      <div className="faq-toolbar">
        <span className="faq-toolbar-title">
          El agente usa estas preguntas para responder por chat y WhatsApp.
        </span>
        <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
          + Nueva pregunta
        </button>
      </div>

      {loading && <p className="admin-empty">Cargando...</p>}
      {!loading && faqs.length === 0 && (
        <p className="admin-empty">Todavía no hay preguntas frecuentes cargadas.</p>
      )}

      {!loading && faqs.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pregunta</th>
                <th>Categoría</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq) => (
                <tr key={faq.id}>
                  <td>
                    <div>{faq.question}</div>
                    {faq.keywords.length > 0 && (
                      <div className="faq-keywords">
                        Keywords: {faq.keywords.join(", ")}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="faq-category-tag">{faq.category}</span>
                  </td>
                  <td>
                    <div className="faq-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(faq)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={deletingId === faq.id}
                        onClick={() => handleDelete(faq.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">
              {editingId ? "Editar pregunta frecuente" : "Nueva pregunta frecuente"}
            </p>

            <div className="form-field">
              <label className="form-label">Pregunta</label>
              <input
                className="form-input"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="¿Cuál es el horario de atención?"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Respuesta</label>
              <textarea
                className="form-textarea"
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="La atención al público es de lunes a viernes de 8 a 14 hs."
              />
            </div>

            <div className="form-field">
              <label className="form-label">Categoría</label>
              <input
                className="form-input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="horarios, tramites, pagos, reclamos..."
              />
            </div>

            <div className="form-field">
              <label className="form-label">Keywords (separadas por coma)</label>
              <input
                className="form-input"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="horario, atencion, abren"
              />
              <p className="form-hint">
                El agente las usa para encontrar esta respuesta al buscar en la base.
              </p>
            </div>

            {formError && <p className="login-error">{formError}</p>}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
