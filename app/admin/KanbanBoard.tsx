"use client";

import { useEffect, useRef, useState } from "react";
import CaseDetailModal from "./CaseDetailModal";

type CaseStatus =
  | "PENDIENTE"
  | "EN_REVISION"
  | "EN_PROCESO"
  | "RESUELTO"
  | "FINALIZADO"
  | "REABIERTO";

interface CaseRecord {
  id: string;
  citizenName: string;
  citizenContact: string;
  description: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

interface ColumnDef {
  status: CaseStatus;
  label: string;
  hint: string;
}

const COLUMNS: ColumnDef[] = [
  { status: "PENDIENTE", label: "Pendiente", hint: "Recién ingresado" },
  { status: "EN_REVISION", label: "En revisión", hint: "Evaluando el reclamo" },
  { status: "EN_PROCESO", label: "En proceso", hint: "Asignado, trabajando" },
  {
    status: "RESUELTO",
    label: "Resuelto",
    hint: "Esperando confirmación del ciudadano",
  },
  { status: "FINALIZADO", label: "Finalizado", hint: "Cerrado" },
  { status: "REABIERTO", label: "Reabierto", hint: "El ciudadano dijo que no" },
];

export default function KanbanBoard() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CaseStatus | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const wasDraggedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/cases")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) setCases(data.cases);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function moveCase(id: string, status: CaseStatus) {
    const current = cases.find((c) => c.id === id);
    if (!current || current.status === status) return;

    // Optimistic update para que el drag se sienta instantáneo.
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));

    const res = await fetch(`/api/admin/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      // Revertir si falló.
      setRefreshToken((n) => n + 1);
    }
  }

  function handleDrop(status: CaseStatus) {
    setDragOverColumn(null);
    if (draggingId) {
      void moveCase(draggingId, status);
    }
    setDraggingId(null);
    // No confiar en que "dragend" se dispare: si el drop mueve la tarjeta a
    // otra columna, React la desmonta del nodo original antes de que el
    // navegador llegue a emitir dragend, y el flag quedaría trabado en true
    // bloqueando el click en todas las tarjetas para siempre.
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 0);
  }

  if (loading) return <p className="admin-empty">Cargando casos...</p>;

  return (
    <div className="kanban-board">
      {COLUMNS.map((column) => {
        const columnCases = cases.filter((c) => c.status === column.status);
        return (
          <div
            key={column.status}
            className={`kanban-column${dragOverColumn === column.status ? " drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(column.status);
            }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(column.status);
            }}
          >
            <div className="kanban-column-header">
              <div>
                <div className="kanban-column-title">{column.label}</div>
                <div className="kanban-card-contact">{column.hint}</div>
              </div>
              <span className="kanban-column-count">{columnCases.length}</span>
            </div>
            <div className="kanban-column-body">
              {columnCases.length === 0 && (
                <p className="kanban-column-empty">Sin casos</p>
              )}
              {columnCases.map((c) => (
                <div
                  key={c.id}
                  className={`kanban-card${draggingId === c.id ? " dragging" : ""}`}
                  draggable
                  onDragStart={() => {
                    wasDraggedRef.current = true;
                    setDraggingId(c.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setTimeout(() => {
                      wasDraggedRef.current = false;
                    }, 0);
                  }}
                  onClick={() => {
                    if (wasDraggedRef.current) return;
                    setSelectedCaseId(c.id);
                  }}
                >
                  <div className="kanban-card-name">{c.citizenName}</div>
                  <div className="kanban-card-contact">{c.citizenContact}</div>
                  <div className="kanban-card-desc">{c.description}</div>
                  <div className="kanban-card-footer">
                    <span className="kanban-card-id" title={c.id}>
                      #{c.id.slice(-6)}
                    </span>
                    <span className="kanban-card-date">
                      {new Date(c.createdAt).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
        />
      )}
    </div>
  );
}
