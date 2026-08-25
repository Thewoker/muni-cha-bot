"use client";

import { useEffect, useState } from "react";

type WhatsAppStatus = "disconnected" | "connecting" | "qr" | "connected";

interface StatusResponse {
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  phoneNumber: string | null;
}

const STATUS_LABEL: Record<WhatsAppStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando...",
  qr: "Esperando escaneo de QR",
  connected: "Conectado",
};

const POLL_INTERVAL_MS = 3000;

export default function WhatsAppPanel() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await fetch("/api/admin/whatsapp");
      if (!cancelled && res.ok) {
        setData(await res.json());
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshToken]);

  async function handleConnect() {
    setBusy(true);
    const res = await fetch("/api/admin/whatsapp/connect", { method: "POST" });
    if (res.ok) setData(await res.json());
    setBusy(false);
    setRefreshToken((n) => n + 1);
  }

  async function handleDisconnect() {
    setBusy(true);
    const res = await fetch("/api/admin/whatsapp/disconnect", {
      method: "POST",
    });
    if (res.ok) setData(await res.json());
    setBusy(false);
    setRefreshToken((n) => n + 1);
  }

  const status = data?.status ?? "disconnected";

  return (
    <div>
      <div className="wa-status-row">
        <span className={`wa-dot ${status}`} />
        <div>
          <div className="wa-status-text">{STATUS_LABEL[status]}</div>
          {status === "connected" && data?.phoneNumber && (
            <div className="wa-status-detail">
              Número conectado: +{data.phoneNumber}
            </div>
          )}
          {status !== "connected" && (
            <div className="wa-status-detail">
              El chatbot responde por este canal cuando está conectado.
            </div>
          )}
        </div>
      </div>

      {status === "qr" && data?.qrDataUrl && (
        <div className="wa-qr-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrDataUrl} alt="Código QR de WhatsApp" />
          <span className="wa-status-detail">
            Escaneá este código desde WhatsApp → Dispositivos vinculados
          </span>
        </div>
      )}

      <div className="wa-actions">
        {status === "disconnected" && (
          <button className="btn btn-primary" onClick={handleConnect} disabled={busy}>
            Conectar WhatsApp
          </button>
        )}
        {(status === "qr" || status === "connecting") && (
          <button className="btn btn-danger" onClick={handleDisconnect} disabled={busy}>
            Cancelar
          </button>
        )}
        {status === "connected" && (
          <button className="btn btn-danger" onClick={handleDisconnect} disabled={busy}>
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}
