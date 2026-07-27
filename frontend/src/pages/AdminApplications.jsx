import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { STATUS_LABEL } from "@/constants/options";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_FILTER = [
  { value: "todas", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_revision", label: "En revisión" },
  { value: "aprobada", label: "Aprobada" },
  { value: "denegada", label: "Denegada" },
];
const DORM_FILTER = [
  { value: "todos", label: "Todos los dormitorios" },
  { value: "1", label: "1 dormitorio" },
  { value: "2", label: "2 dormitorios" },
  { value: "3", label: "3 dormitorios" },
  { value: "4", label: "4 dormitorios" },
];

export default function AdminApplications() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todas");
  const [dorm, setDorm] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { q: q || undefined, status: status === "todas" ? undefined : status, dormitorios: dorm === "todos" ? undefined : dorm, page, page_size: pageSize };
    try {
      const r = await api.get("/admin/applications", { params });
      setData(r.data);
    } finally {
      setLoading(false);
    }
  }, [q, status, dorm, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));

  return (
    <div className="App">
      <Header variant="admin" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Solicitudes</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1">Listado de inscripciones</h1>
        </div>

        <Card className="p-4 border-[color:var(--hemsa-border)] mb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--hemsa-muted)]" />
              <Input
                className="pl-9"
                placeholder="Buscar por nº de registro, nombre, DNI o email…"
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
                data-testid={ADMIN.applicationsSearch}
              />
            </div>
            <div className="md:col-span-3">
              <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
                <SelectTrigger data-testid={ADMIN.applicationsStatusFilter}><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_FILTER.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select value={dorm} onValueChange={(v) => { setPage(1); setDorm(v); }}>
                <SelectTrigger data-testid="admin-applications-dorm-filter"><SelectValue /></SelectTrigger>
                <SelectContent>{DORM_FILTER.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="border-[color:var(--hemsa-border)] overflow-hidden">
          <Table data-testid={ADMIN.applicationsTable}>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Registro</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Régimen</TableHead>
                <TableHead>Dorm.</TableHead>
                <TableHead>Baremo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-[color:var(--hemsa-muted)]">Cargando…</TableCell></TableRow>
              )}
              {!loading && data.items.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-[color:var(--hemsa-muted)]">No hay solicitudes que coincidan.</TableCell></TableRow>
              )}
              {!loading && data.items.map((it) => (
                <TableRow key={it.application_id} className="hover:bg-[color:var(--hemsa-surface)] cursor-pointer" data-testid={`row-${it.application_id}`}>
                  <TableCell className="font-mono text-sm font-semibold">{it.numero_registro}</TableCell>
                  <TableCell>{`${it.titular1?.nombre || ""} ${it.titular1?.apellido1 || ""} ${it.titular1?.apellido2 || ""}`.trim() || "—"}</TableCell>
                  <TableCell className="text-xs">{it.titular1?.tipo_documento} {it.titular1?.numero_documento}</TableCell>
                  <TableCell className="text-xs">{(it.vivienda?.regimen || []).join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs">{(it.vivienda?.dormitorios || []).join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {it.score !== undefined && it.score !== null ? (
                      <span className="font-mono font-bold text-[color:var(--hemsa-green-hover)]">{it.score}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell><span className={`status-pill status-${it.status}`}>{STATUS_LABEL[it.status] || it.status}</span></TableCell>
                  <TableCell>
                    {it.origen_alta === 'ocr' ? (
                      <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-semibold">OCR IA</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-semibold">Web</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[color:var(--hemsa-muted)]">{new Date(it.created_at).toLocaleDateString("es-ES")}</TableCell>
                  <TableCell><Button asChild size="sm" variant="ghost"><Link to={`/admin/solicitudes/${it.application_id}`} data-testid={`view-${it.application_id}`}>Ver</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-[color:var(--hemsa-muted)]">
            {data.total} solicitudes · página {page} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} data-testid="pagination-prev">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="pagination-next">
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}