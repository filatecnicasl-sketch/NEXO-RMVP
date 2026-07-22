import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const LEVEL_ICON = {
  success: <CheckCircle2 className="h-4 w-4 text-[color:var(--hemsa-green)]" />,
  error: <AlertCircle className="h-4 w-4 text-[color:var(--hemsa-error)]" />,
  info: <Info className="h-4 w-4 text-[color:var(--hemsa-info)]" />,
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/notifications", { params: { limit: 30 } });
      setItems(r.data.items || []);
      setUnread(r.data.unread_count || 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await api.patch("/notifications/read-all");
    load();
  };

  const onClickItem = async (n) => {
    if (!n.read) {
      try { await api.patch(`/notifications/${n.notification_id}/read`); } catch {}
    }
    setOpen(false);
    if (n.application_id) {
      navigate("/dashboard");
    }
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} className="relative" data-testid="notification-bell">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--hemsa-green)] text-white text-[10px] font-bold flex items-center justify-center" data-testid="notification-unread-count">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-12 w-[360px] max-w-[90vw] bg-white border border-[color:var(--hemsa-border)] rounded-xl shadow-lg z-50" data-testid="notification-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--hemsa-border)]">
            <div className="font-heading font-semibold text-[color:var(--hemsa-text)]">Notificaciones</div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <Button variant="ghost" size="sm" onClick={markAll} className="text-xs" data-testid="notification-mark-all">
                  Marcar todas leídas
                </Button>
              )}
              <button onClick={() => setOpen(false)} className="text-[color:var(--hemsa-muted)] hover:text-[color:var(--hemsa-text)]">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {items.length === 0 && (
              <div className="p-8 text-center text-sm text-[color:var(--hemsa-muted)]">No tiene notificaciones.</div>
            )}
            {items.map((n) => (
              <button key={n.notification_id} onClick={() => onClickItem(n)} className={`w-full text-left flex gap-3 px-4 py-3 border-b border-[color:var(--hemsa-border)] hover:bg-[color:var(--hemsa-surface)] transition-colors ${n.read ? "opacity-60" : ""}`} data-testid={`notification-item-${n.notification_id}`}>
                <div className="mt-0.5 flex-shrink-0">{LEVEL_ICON[n.level] || LEVEL_ICON.info}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[color:var(--hemsa-text)]">{n.title}</div>
                  <div className="text-xs text-[color:var(--hemsa-muted)] mt-0.5 line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-[color:var(--hemsa-muted)] mt-1 uppercase tracking-wide">{new Date(n.created_at).toLocaleString("es-ES")}</div>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-[color:var(--hemsa-green)] mt-1.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
