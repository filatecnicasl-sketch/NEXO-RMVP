import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, Clock, CheckCircle2, XCircle, Upload, FileSpreadsheet, ArrowRight, Download } from "lucide-react";

const STATUS_COLORS = {
  pendiente: "#F59E0B",
  en_revision: "#3B82F6",
  aprobada: "#10B981",
  denegada: "#EF4444",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const cards = [
    { key: "total", label: "Total de solicitudes", value: stats?.total ?? "—", icon: <Users className="h-5 w-5" />, tid: ADMIN.statTotal, accent: "var(--hemsa-green)" },
    { key: "pendientes", label: "Pendientes", value: stats?.pendientes ?? "—", icon: <Clock className="h-5 w-5" />, tid: ADMIN.statPendientes, accent: "#F59E0B" },
    { key: "aprobadas", label: "Aprobadas", value: stats?.aprobadas ?? "—", icon: <CheckCircle2 className="h-5 w-5" />, tid: ADMIN.statAprobadas, accent: "#10B981" },
    { key: "denegadas", label: "Denegadas", value: stats?.denegadas ?? "—", icon: <XCircle className="h-5 w-5" />, tid: ADMIN.statDenegadas, accent: "#EF4444" },
  ];

  const downloadFile = async (path, filename) => {
    const res = await api.get(path, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  const pieData = (stats?.por_estado || []).map((s) => ({ name: s.estado, value: s.count }));

  return (
    <div className="App">
      <Header variant="admin" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter" data-testid={ADMIN.dashboard}>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Panel administración</div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1">Resumen del registro</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => downloadFile("/admin/export/csv", "solicitudes_hemsa.csv")} variant="outline" data-testid={ADMIN.exportCsvBtn} className="rounded-full">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
            <Button onClick={() => downloadFile("/admin/export/xlsx", "solicitudes_hemsa.xlsx")} variant="outline" data-testid={ADMIN.exportXlsxBtn} className="rounded-full">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
            </Button>
            <Button
              onClick={() => downloadFile("/admin/download-source", "hemsa-codigo-fuente.zip")}
              variant="outline"
              className="rounded-full border-[color:var(--hemsa-green)] text-[color:var(--hemsa-green-hover)] hover:bg-[color:var(--hemsa-green-soft)]"
              data-testid="admin-download-source-btn"
              title="Descarga el código fuente completo del programa (ZIP). Solo Gerente."
            >
              <Download className="h-4 w-4 mr-1" /> Descargar código fuente (ZIP)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => (
            <Card key={c.key} className="p-5 border-[color:var(--hemsa-border)]" data-testid={c.tid}>
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold">{c.label}</div>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white" style={{ background: c.accent }}>{c.icon}</div>
              </div>
              <div className="font-heading text-3xl font-extrabold text-[color:var(--hemsa-text)] mt-3">{c.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 border-[color:var(--hemsa-border)] lg:col-span-2">
            <div className="text-sm font-semibold text-[color:var(--hemsa-text)] mb-4">Solicitudes por mes</div>
            <div style={{ height: 280, minHeight: 280, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.por_mes || []}>
                  <XAxis dataKey="mes" stroke="#7A7A7A" fontSize={12} />
                  <YAxis stroke="#7A7A7A" fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2ECC8B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-6 border-[color:var(--hemsa-border)]">
            <div className="text-sm font-semibold text-[color:var(--hemsa-text)] mb-4">Distribución por estado</div>
            <div style={{ height: 280, minHeight: 280, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {pieData.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.name] || "#7A7A7A"} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Card className="p-6 border-[color:var(--hemsa-border)] hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold">Acciones rápidas</div>
                <div className="font-heading text-xl font-bold mt-1">Ver todas las solicitudes</div>
                <p className="text-sm text-[color:var(--hemsa-muted)] mt-1">Listado completo con filtros, búsqueda y exportación.</p>
              </div>
              <Button asChild className="hemsa-btn-primary rounded-full"><Link to="/admin/solicitudes" data-testid="quick-link-solicitudes">Abrir <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            </div>
          </Card>
          <Card className="p-6 border-[color:var(--hemsa-border)] hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold">Alta automática</div>
                <div className="font-heading text-xl font-bold mt-1">Subir PDF y dar de alta con IA</div>
                <p className="text-sm text-[color:var(--hemsa-muted)] mt-1">OCR con inteligencia artificial (motor principal y respaldo automático).</p>
              </div>
              <Button asChild variant="outline" className="rounded-full"><Link to="/admin/ocr" data-testid="quick-link-ocr"><Upload className="h-4 w-4 mr-1" /> Abrir</Link></Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}