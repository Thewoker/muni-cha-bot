"use client";

import { useEffect, useState } from "react";

type CaseStatus =
  | "PENDIENTE"
  | "EN_REVISION"
  | "EN_PROCESO"
  | "RESUELTO"
  | "FINALIZADO"
  | "REABIERTO";

interface StatusLogEntry {
  id: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  changedAt: string;
  note: string | null;
}

interface MessageEntry {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

interface CaseDetail {
  id: string;
  citizenName: string;
  citizenContact: string;
  description: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusLogEntry[];
  conversation: { messages: MessageEntry[] } | null;
}

const STATUS_LABEL: Record<CaseStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  EN_PROCESO: "En proceso",
  RESUELTO: "Resuelto",
  FINALIZADO: "Finalizado",
  REABIERTO: "Reabierto",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CaseDetailModal({
  caseId,
  onClose,
}: {
  caseId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/cases/${caseId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body) => {
        if (!cancelled) setData(body.case);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el detalle del caso.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-header">
          <p className="modal-title">
            {loading ? "Cargando..." : data?.citizenName ?? "Caso"}
          </p>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="detail-id">#{caseId}</p>

        {loading && <p className="admin-empty">Cargando detalle...</p>}
        {error && <p className="login-error">{error}</p>}

        {data && (
          <>
            <div className="detail-grid">
              <div>
                <div className="detail-field-label">Estado</div>
                <span className={`status-badge status-${data.status}`}>
                  {STATUS_LABEL[data.status]}
                </span>
              </div>
              <div>
                <div className="detail-field-label">Contacto</div>
                <div className="detail-field-value">{data.citizenContact}</div>
              </div>
              <div>
                <div className="detail-field-label">Creado</div>
                <div className="detail-field-value">
                  {formatDateTime(data.createdAt)}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Última actualización</div>
                <div className="detail-field-value">
                  {formatDateTime(data.updatedAt)}
                </div>
              </div>
            </div>

            <div className="detail-field-label">Descripción del reclamo</div>
            <p className="detail-description">{data.description}</p>

            <p className="detail-section-title">Historial de estados</p>
            <div className="timeline">
              {data.statusHistory.map((entry) => (
                <div className="timeline-item" key={entry.id}>
                  <span className="timeline-dot" />
                  <div className="timeline-body">
                    <div>
                      {entry.fromStatus
                        ? `${STATUS_LABEL[entry.fromStatus]} → ${STATUS_LABEL[entry.toStatus]}`
                        : `Creado como ${STATUS_LABEL[entry.toStatus]}`}
                    </div>
                    <div className="timeline-date">
                      {formatDateTime(entry.changedAt)}
                    </div>
                    {entry.note && <div className="timeline-note">{entry.note}</div>}
                  </div>
                </div>
              ))}
            </div>

            {data.conversation && data.conversation.messages.length > 0 && (
              <>
                <p className="detail-section-title">Conversación con el chatbot</p>
                <div className="chat-log">
                  {data.conversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-bubble ${message.role === "USER" ? "user" : "assistant"}`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
