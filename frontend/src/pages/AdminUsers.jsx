import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Users, UserPlus, Shield, User as UserIcon, KeyRound, Trash2, Search, Lock, CheckCircle2, XCircle } from "lucide-react";

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [loading, setLoading] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [newAdminLevel, setNewAdminLevel] = useState("administracion");
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPwd, setResetPwd] = useState("");

  // Change own password
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { q: q || undefined, role: roleFilter === "todos" ? undefined : roleFilter };
      const r = await api.get("/admin/users", { params });
      setItems(r.data.items || []);
    } catch { toast.error("No se pudieron cargar los usuarios"); }
    setLoading(false);
  }, [q, roleFilter]);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const createUser = async () => {
    if (newPassword.length < 8) return toast.error("Mínimo 8 caracteres");
    setCreating(true);
    try {
      const body = { name: newName, email: newEmail, password: newPassword, role: newRole };
      if (newRole === "admin") body.admin_level = newAdminLevel;
      await api.post("/admin/users", body);
      toast.success(`Usuario creado: ${newEmail}`);
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("admin"); setNewAdminLevel("administracion");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo crear"); }
    setCreating(false);
  };

  const changeAdminLevel = async (u, admin_level) => {
    try {
      await api.patch(`/admin/users/${u.user_id}`, { admin_level });
      toast.success(`Nivel cambiado a ${admin_level}`);
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo cambiar el nivel"); }
  };

  const toggleDisabled = async (u) => {
    try {
      await api.patch(`/admin/users/${u.user_id}`, { disabled: !u.disabled });
      toast.success(u.disabled ? "Usuario habilitado" : "Usuario deshabilitado");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo actualizar"); }
  };

  const changeRole = async (u, role) => {
    try {
      await api.patch(`/admin/users/${u.user_id}`, { role });
      toast.success(`Rol cambiado a ${role}`);
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo cambiar el rol"); }
  };

  const submitReset = async () => {
    if (resetPwd.length < 8) return toast.error("Mínimo 8 caracteres");
    try {
      await api.post(`/admin/users/${resetTarget.user_id}/reset-password`, { new_password: resetPwd });
      toast.success("Contraseña restablecida");
      setResetOpen(false); setResetPwd(""); setResetTarget(null);
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo restablecer"); }
  };

  const submitChangePw = async () => {
    if (newPw.length < 8) return toast.error("Mínimo 8 caracteres");
    try {
      await api.post("/auth/change-password", { current_password: curPw, new_password: newPw });
      toast.success("Su contraseña ha sido cambiada");
      setPwOpen(false); setCurPw(""); setNewPw("");
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo cambiar"); }
  };

  return (
    <div className="App">
      <Header variant="admin" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Administración</div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1 flex items-center gap-3">
              <Users className="h-7 w-7 text-[color:var(--hemsa-green)]" /> Usuarios
            </h1>
            <p className="mt-2 text-sm text-[color:var(--hemsa-muted)] max-w-2xl">
              Gestione los administradores y ciudadanos del sistema. Solo los administradores pueden acceder a esta sección.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setPwOpen(true)} variant="outline" className="rounded-full" data-testid="my-change-pw-btn">
              <Lock className="h-4 w-4 mr-1" /> Mi contraseña
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="hemsa-btn-primary rounded-full" data-testid="create-user-btn">
              <UserPlus className="h-4 w-4 mr-1" /> Nuevo usuario
            </Button>
          </div>
        </div>

        <Card className="p-4 border-[color:var(--hemsa-border)] mb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-9 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--hemsa-muted)]" />
              <Input className="pl-9" placeholder="Buscar por nombre o email…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="users-search" />
            </div>
            <div className="md:col-span-3">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-testid="users-role-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="citizen">Ciudadanos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="border-[color:var(--hemsa-border)] overflow-hidden">
          <Table data-testid="users-table">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Nivel admin</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center py-10 text-[color:var(--hemsa-muted)]">Cargando…</TableCell></TableRow>}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-[color:var(--hemsa-muted)]">No hay usuarios.</TableCell></TableRow>}
              {!loading && items.map((u) => (
                <TableRow key={u.user_id} data-testid={`user-row-${u.user_id}`} className={u.disabled ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{u.name || "—"}{u.user_id === me?.user_id && <span className="ml-2 text-[10px] uppercase tracking-wider text-[color:var(--hemsa-green-hover)] font-bold">(usted)</span>}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      {u.role === "admin" ? <Shield className="h-3.5 w-3.5 text-[color:var(--hemsa-green)]" /> : <UserIcon className="h-3.5 w-3.5 text-[color:var(--hemsa-muted)]" />}
                      {u.role === "admin" ? "Administrador" : "Ciudadano"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      u.user_id === me?.user_id ? (
                        <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider font-bold text-[color:var(--hemsa-green-hover)]" data-testid={`admin-level-self-${u.user_id}`}>
                          {u.admin_level || "—"}
                        </span>
                      ) : (
                        <Select value={u.admin_level || "administracion"} onValueChange={(v) => changeAdminLevel(u, v)}>
                          <SelectTrigger className="h-8 w-[150px] text-xs" data-testid={`admin-level-select-${u.user_id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="administracion">Administración</SelectItem>
                            <SelectItem value="lector">Lector</SelectItem>
                          </SelectContent>
                        </Select>
                      )
                    ) : (
                      <span className="text-xs text-[color:var(--hemsa-muted)]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">{u.auth_provider}</TableCell>
                  <TableCell>
                    {u.disabled
                      ? <span className="inline-flex items-center gap-1 text-xs text-[color:var(--hemsa-error)] font-semibold"><XCircle className="h-3 w-3" /> Deshabilitado</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-[color:var(--hemsa-green-hover)] font-semibold"><CheckCircle2 className="h-3 w-3" /> Activo</span>}
                  </TableCell>
                  <TableCell className="text-xs text-[color:var(--hemsa-muted)]">{u.created_at ? new Date(u.created_at).toLocaleDateString("es-ES") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {u.role !== "admin" && u.user_id !== me?.user_id && (
                        <Button size="sm" variant="ghost" onClick={() => changeRole(u, "admin")} title="Promover a administrador" data-testid={`promote-${u.user_id}`}>
                          <Shield className="h-4 w-4" />
                        </Button>
                      )}
                      {u.role === "admin" && u.user_id !== me?.user_id && (
                        <Button size="sm" variant="ghost" onClick={() => changeRole(u, "citizen")} title="Revocar permisos de admin" data-testid={`demote-${u.user_id}`}>
                          <UserIcon className="h-4 w-4" />
                        </Button>
                      )}
                      {u.auth_provider === "password" && (
                        <Button size="sm" variant="ghost" onClick={() => { setResetTarget(u); setResetOpen(true); }} title="Restablecer contraseña" data-testid={`reset-pw-${u.user_id}`}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      )}
                      {u.user_id !== me?.user_id && (
                        <Button size="sm" variant="ghost" onClick={() => toggleDisabled(u)} title={u.disabled ? "Habilitar" : "Deshabilitar"} data-testid={`toggle-${u.user_id}`} className={u.disabled ? "" : "text-[color:var(--hemsa-error)]"}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>

      {/* Crear usuario */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="create-user-modal">
          <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre completo</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="new-user-name" /></div>
            <div><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="new-user-email" /></div>
            <div><Label>Contraseña (mín. 8)</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="new-user-password" /></div>
            <div><Label>Rol</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="new-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="citizen">Ciudadano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newRole === "admin" && (
              <div>
                <Label>Nivel de administrador</Label>
                <Select value={newAdminLevel} onValueChange={setNewAdminLevel}>
                  <SelectTrigger data-testid="new-user-admin-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerente">Gerente · Acceso total + firmar digitalmente</SelectItem>
                    <SelectItem value="administracion">Administración · Gestión diaria sin firma</SelectItem>
                    <SelectItem value="lector">Lector · Solo lectura</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[color:var(--hemsa-muted)] mt-1">
                  Solo los Gerentes pueden firmar digitalmente (FNMT), configurar el baremo y gestionar usuarios.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createUser} disabled={creating || !newName || !newEmail || !newPassword} className="hemsa-btn-primary rounded-full" data-testid="create-user-submit">
              {creating ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restablecer contraseña de {resetTarget?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nueva contraseña (mín. 8)</Label>
            <Input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} data-testid="reset-pw-input" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button onClick={submitReset} className="hemsa-btn-primary rounded-full" data-testid="reset-pw-submit">Restablecer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mi contraseña */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cambiar mi contraseña</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Contraseña actual</Label><Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} data-testid="my-current-pw" /></div>
            <div><Label>Nueva contraseña (mín. 8)</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} data-testid="my-new-pw" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancelar</Button>
            <Button onClick={submitChangePw} className="hemsa-btn-primary rounded-full" data-testid="my-new-pw-submit">Cambiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
