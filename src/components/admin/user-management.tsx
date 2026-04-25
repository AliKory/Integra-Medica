"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Users,
  Search,
  Plus,
  Trash2,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  KeyRound,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"

import { db } from "@/lib/firebase"
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore"
import { useAuth } from "@/hooks/use-auth"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string
  uid: string
  fullName: string
  phone: string
  role: "ADMIN" | "RECEPCION" | "PACIENTE"
  active?: boolean
  createdAt?: any
}

interface ActivityLog {
  id: string
  timestamp: any
  action: string
  userName: string
  targetUserName?: string
  type: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isInactive = (u: UserRecord) => u.active === false

// ─── Reglas de contraseña ────────────────────────────────────────────────────
const PW_RULES = [
  { label: "8+ caracteres",       test: (v: string) => v.length >= 8           },
  { label: "1 mayúscula",         test: (v: string) => /[A-Z]/.test(v)         },
  { label: "1 número",            test: (v: string) => /[0-9]/.test(v)         },
  { label: "1 carácter especial", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

const STRENGTH_COLORS = ["#E24B4A", "#EF9F27", "#EF9F27", "#1D9E75"]
const passwordValid = (v: string) => PW_RULES.every(r => r.test(v))

// ─── Componente: indicador de fortaleza ──────────────────────────────────────
function PasswordStrength({ value }: { value: string }) {
  const results = PW_RULES.map(r => r.test(value))
  const passed  = results.filter(Boolean).length
  const color   = value.length === 0
    ? "var(--color-border-tertiary)"
    : STRENGTH_COLORS[passed - 1] ?? "#1D9E75"

  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-200"
            style={{ background: i < passed ? color : "var(--color-border-tertiary, #e5e7eb)" }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {PW_RULES.map((rule, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
              style={{
                background: results[i] ? "#1D9E75" : "transparent",
                border:     results[i] ? "1.5px solid #1D9E75" : "1.5px solid var(--color-border-secondary, #d1d5db)",
              }}
            >
              {results[i] && (
                <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                  <polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-[11px]" style={{ color: results[i] ? "#1D9E75" : "var(--color-text-secondary, #6b7280)" }}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Modal: Crear usuario ─────────────────────────────────────────────────────
interface CreateUserModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (name: string) => void
}

function CreateUserModal({ open, onOpenChange, onCreated }: CreateUserModalProps) {
  const { adminCreateUser, isLoading, error: authError } = useAuth();
  
  const [fullName,         setFullName]         = useState("")
  const [phone,            setPhone]            = useState("")
  const [password,         setPassword]         = useState("")
  const [confirmPassword,  setConfirmPassword]  = useState("")
  const [role,             setRole]             = useState<"RECEPCION" | "ADMIN" | "PACIENTE">("RECEPCION")

  // UI
  const [showPw,      setShowPw]      = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSaving,    setIsSaving]    = useState(false)
  const [apiError,    setApiError]    = useState<string | null>(null)

  // Validaciones extra
  const phoneOk    = phone.replace(/\D/g, "").length === 10
  const passwordsMatch = password === confirmPassword
  const canSubmit  = fullName.trim().length >= 2 && phoneOk && passwordValid(password) && passwordsMatch && !isSaving

  // Reset al cerrar
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setFullName(""); setPhone(""); setPassword(""); setConfirmPassword("")
      setRole("RECEPCION"); setShowPw(false); setShowConfirm(false)
      setApiError(null)
    }
    onOpenChange(v)
  }

 const handleSubmit = async () => {
  // 1. Validar campos manualmente si es necesario
  if (!fullName || !phone || !password || !role) {
    toast.error("Por favor llena todos los campos");
    return;
  }

  try {
    console.log("Intentando crear usuario..."); // Para debug
    await adminCreateUser({
      fullName: fullName.trim(),
      phone: phone.replace(/\D/g, ""), // Limpieza de caracteres no numéricos
      password: password,
      confirmPassword: password, // Para cumplir con el tipo RegisterFormData
      role: role,
    });

    // Si llega aquí, fue exitoso
    toast.success("Usuario creado exitosamente");
    onCreated(fullName.trim());
    onOpenChange(false); // Cerrar el modal
  } catch (err) {
    // El error ya lo guarda el hook en su estado 'error', 
    // pero aquí puedes poner un toast para verlo visualmente
    console.error("Error en el componente:", err);
  }
};
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {apiError && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{apiError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cu-name">Nombre completo</Label>
            <Input
              id="cu-name"
              placeholder="Juan Pérez López"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoComplete="off"
            />
            {fullName.length > 0 && fullName.trim().length < 2 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Ingresa al menos 2 caracteres
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-phone">Teléfono</Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm font-medium select-none">
                +52
              </span>
              <Input
                id="cu-phone"
                className="rounded-l-none"
                placeholder="442 000 0000"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <p className={cn(
              "text-[10px] transition-colors",
              phone.length > 0 && !phoneOk ? "text-destructive" : "text-muted-foreground"
            )}>
              {phone.length}/10 dígitos — se guardará como +52{phone}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Contraseña</Label>
            <div className="relative">
              <Input
                id="cu-password"
                type={showPw ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && <PasswordStrength value={password} />}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-confirm">Confirmar contraseña</Label>
            <div className="relative">
              <Input
                id="cu-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={cn(
                  "pr-10",
                  confirmPassword.length > 0 && !passwordsMatch && "border-destructive focus-visible:ring-destructive/30"
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={cn(
                "text-xs flex items-center gap-1 transition-colors",
                passwordsMatch ? "text-emerald-600" : "text-destructive"
              )}>
                {passwordsMatch
                  ? <><Check className="w-3 h-3" /> Las contraseñas coinciden</>
                  : <><X     className="w-3 h-3" /> Las contraseñas no coinciden</>
                }
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEPCION">Recepcionista</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="PACIENTE">Paciente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
  onClick={handleSubmit} 
  disabled={isLoading || !canSubmit} // Si isLoading es true, el botón no hace nada
>
  {isLoading ? <Loader2 className="animate-spin" /> : "Crear Usuario"}
</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function UserManagement() {
  const [users,        setUsers]        = useState<UserRecord[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  const [searchQuery,   setSearchQuery]   = useState("")
  const [filterRole,    setFilterRole]    = useState<string>("all")
  const [filterStatus,  setFilterStatus]  = useState<string>("all")

  const [createOpen, setCreateOpen] = useState(false)

  // Eliminar
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)

  // Cambiar contraseña
  const [pwTarget,     setPwTarget]     = useState<UserRecord | null>(null)
  const [changePwValue,setChangePwValue]= useState("")
  const [showChangePw, setShowChangePw] = useState(false)
  const [isSavingPw,   setIsSavingPw]   = useState(false)

  const [togglingId,    setTogglingId]    = useState<string | null>(null)
  const [activityLogs,  setActivityLogs]  = useState<ActivityLog[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  // Usuarios en tiempo real
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("fullName", "asc"))
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord)))
      setLoadingUsers(false)
    })
  }, [])

  // Actividad reciente
  useEffect(() => {
    const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), limit(10))
    return onSnapshot(q, snap => {
      setActivityLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)))
      setLoadingActivity(false)
    })
  }, [])

  const logActivity = async (action: string, type: string, targetName?: string) => {
    try {
      await addDoc(collection(db, "activityLogs"), {
        timestamp: serverTimestamp(),
        action,
        userName: "ADMIN",
        targetUserName: targetName ?? "",
        type,
      })
    } catch (e) { console.error(e) }
  }

  // Filtros
  const filteredUsers = useMemo(() => users.filter(u => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = u.fullName?.toLowerCase().includes(q) || u.phone?.includes(searchQuery)
    const matchesRole   = filterRole === "all" || u.role === filterRole
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active"   && !isInactive(u)) ||
      (filterStatus === "inactive" &&  isInactive(u))
    return matchesSearch && matchesRole && matchesStatus
  }), [users, searchQuery, filterRole, filterStatus])

  const stats = {
    total:     users.length,
    active:    users.filter(u => !isInactive(u)).length,
    inactive:  users.filter(u =>  isInactive(u)).length,
    admins:    users.filter(u => u.role?.toUpperCase() === "ADMIN").length,
    recepcion: users.filter(u => u.role?.toUpperCase() === "RECEPCION").length,
  }

  // Acciones
  const toggleUserStatus = async (user: UserRecord) => {
    setTogglingId(user.id)
    const nowActive = !isInactive(user)
    try {
      await updateDoc(doc(db, "users", user.id), { active: nowActive })
      toast.success("Estado actualizado")
      await logActivity(`${nowActive ? "Activó" : "Desactivó"} a un usuario`, "status", user.fullName)
    } catch { toast.error("Error") } finally { setTogglingId(null) }
  }

  const deleteUser = async (user: UserRecord) => {
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, "users", user.id))
      toast.success("Eliminado")
      setDeleteTarget(null)
      await logActivity("Eliminó a un usuario", "delete", user.fullName)
    } catch { toast.error("Error") } finally { setIsDeleting(false) }
  }

  const handleChangePassword = async () => {
    if (!pwTarget || !passwordValid(changePwValue)) return
    setIsSavingPw(true)
    try {
      const res = await fetch("/api/admin/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: pwTarget.uid, newPassword: changePwValue }),
      })
      if (!res.ok) throw new Error()
      toast.success("Contraseña actualizada")
      setPwTarget(null)
      setChangePwValue("")
    } catch { toast.error("Error en servidor") } finally { setIsSavingPw(false) }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total",     value: stats.total,     icon: Users,      color: "text-blue-600",    bg: "bg-blue-50"    },
          { label: "Activos",   value: stats.active,    icon: UserCheck,  color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Admins",    value: stats.admins,    icon: ShieldCheck,color: "text-amber-600",   bg: "bg-amber-50"   },
          { label: "Recepción", value: stats.recepcion, icon: Shield,     color: "text-purple-600",  bg: "bg-purple-50"  },
          { label: "Inactivos", value: stats.inactive,  icon: UserX,      color: "text-rose-600",    bg: "bg-rose-50"    },
        ].map((s, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-5 w-5", s.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de usuarios */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-3 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o teléfono..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/30 border-none h-11"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[140px] h-11 bg-muted/30 border-none">
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="RECEPCION">Recepción</SelectItem>
                    <SelectItem value="PACIENTE">Paciente</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setCreateOpen(true)} className="gap-2 h-11">
                  <Plus className="h-4 w-4" /> Nuevo
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {loadingUsers ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-2xl">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No se encontraron usuarios</p>
              </div>
            ) : filteredUsers.map(user => (
              <Card
                key={user.id}
                className={cn("transition-all border-border/50", isInactive(user) && "opacity-60 bg-muted/20")}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-10 w-10 border shrink-0">
                    <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
                      {user.fullName?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{user.fullName}</span>
                      <Badge variant="secondary" className="text-[10px] py-0 shrink-0">{user.role}</Badge>
                      {isInactive(user) && (
                        <Badge variant="destructive" className="text-[10px] py-0 shrink-0">Inactivo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user.phone}</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setPwTarget(user); setChangePwValue(""); setShowChangePw(false) }}>
                        <KeyRound className="h-4 w-4 mr-2" /> Cambiar contraseña
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleUserStatus(user)} disabled={togglingId === user.id}>
                        {isInactive(user)
                          ? <><UserCheck className="h-4 w-4 mr-2" /> Activar</>
                          : <><UserX    className="h-4 w-4 mr-2" /> Desactivar</>
                        }
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(user)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="lg:col-span-1">
          <Card className="h-fit border-border/40 shadow-sm sticky top-6">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5 text-primary" /> Actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {loadingActivity ? (
                <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
              ) : activityLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin actividad reciente</p>
              ) : (
                <div className="space-y-1">
                  {activityLogs.map((log, idx) => (
                    <div key={log.id} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center shrink-0 w-4">
                        <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0 z-10" />
                        {idx < activityLogs.length - 1 && (
                          <div className="w-px flex-1 bg-primary/20 mt-1" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <p className="text-[11px] font-semibold leading-tight text-foreground">{log.action}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {log.targetUserName || "Sistema"} •{" "}
                          {log.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── MODALES ── */}
      <CreateUserModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={name => logActivity(`Creó usuario: ${name}`, "create", name)}
      />

      {/* Cambiar contraseña */}
      <Dialog open={!!pwTarget} onOpenChange={open => { if (!open) { setPwTarget(null); setChangePwValue("") } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>

          {pwTarget && (
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/50">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {pwTarget.fullName?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{pwTarget.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{pwTarget.phone}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <div className="relative">
              <Input
                type={showChangePw ? "text" : "password"}
                placeholder="Crea una contraseña segura"
                value={changePwValue}
                onChange={e => setChangePwValue(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowChangePw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showChangePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {changePwValue.length > 0 && <PasswordStrength value={changePwValue} />}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPwTarget(null)} disabled={isSavingPw}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={isSavingPw || !passwordValid(changePwValue)}>
              {isSavingPw && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
          </AlertDialogHeader>
          {deleteTarget && (
            <p className="text-sm text-muted-foreground px-1">
              Se eliminará permanentemente a{" "}
              <span className="font-semibold text-foreground">{deleteTarget.fullName}</span>.
              Esta acción no se puede deshacer.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteUser(deleteTarget)}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}