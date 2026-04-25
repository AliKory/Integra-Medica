"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  User, Settings, LogOut, Camera, Eye, EyeOff,
  Sun, Moon, Check, AlertCircle, Loader2,
} from "lucide-react"
import { signOut } from "firebase/auth"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { auth, db } from "@/lib/firebase"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useTheme } from "next-themes"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"

// ─── Constants ──────────────────────────────────────────────────────────────

const THEMES = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
]

const PW_RULES = [
  { label: "8+ caracteres",       test: (v: string) => v.length >= 8           },
  { label: "1 mayúscula",         test: (v: string) => /[A-Z]/.test(v)         },
  { label: "1 número",            test: (v: string) => /[0-9]/.test(v)         },
  { label: "1 carácter especial", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

const STRENGTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"]
const passwordValid = (v: string) => PW_RULES.every(r => r.test(v))

const ROLE_STYLES: Record<string, string> = {
  ADMIN:     "bg-amber-100 text-amber-700 border border-amber-200",
  RECEPCION: "bg-violet-100 text-violet-700 border border-violet-200",
  PACIENTE:  "bg-sky-100   text-sky-700   border border-sky-200",
}

// ─── Components ──────────────────────────────────────────────────────────────

function PasswordStrength({ value }: { value: string }) {
  const results = PW_RULES.map(r => r.test(value))
  const passed  = results.filter(Boolean).length
  const color   = value.length === 0 ? "#e5e7eb" : STRENGTH_COLORS[passed - 1]
  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < passed ? color : "#e5e7eb" }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PW_RULES.map((rule, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={{
                background: results[i] ? "#22c55e" : "transparent",
                border: results[i] ? "1.5px solid #22c55e" : "1.5px solid #d1d5db",
              }}>
              {results[i] && (
                <svg width="6" height="6" viewBox="0 0 10 10" fill="none">
                  <polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-[10px]" style={{ color: results[i] ? "#22c55e" : "#6b7280" }}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "integra_medica")

  const controller = new AbortController()
setTimeout(() => controller.abort(), 10000)

  const res = await fetch("https://api.cloudinary.com/v1_1/dvgpuzpff/image/upload", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || "Error al subir imagen")
  }

  const data = await res.json()
  return data.secure_url
}

function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser, updateCurrentUser } = useCurrentUser()
  const [fullName, setFullName] = useState(currentUser?.fullName ?? "")
  const [file,     setFile]     = useState<File | null>(null)
  const [preview,  setPreview]  = useState<string | null>(currentUser?.avatarUrl ?? null)
  const [saving,   setSaving]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && currentUser) {
      setFullName(currentUser.fullName)
      setPreview(currentUser.avatarUrl ?? null)
      setFile(null)
    }
  }, [open, currentUser])

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024) { toast.error("Máximo 2 MB"); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const save = async () => {
  if (!currentUser || !fullName.trim()) return

  setSaving(true)

  try {
    let avatarUrl = currentUser.avatarUrl ?? ""

    if (file) {
      avatarUrl = await uploadToCloudinary(file) // 🔥 AQUÍ EL CAMBIO
    }

    await updateDoc(doc(db, "users", currentUser.id), {
      fullName: fullName.trim(),
      avatarUrl,
      updatedAt: serverTimestamp(),
    })

    updateCurrentUser({ fullName: fullName.trim(), avatarUrl })

    toast.success("Perfil actualizado")
    onClose()

  } catch (e) {
    console.error(e)
    toast.error("Error al guardar")
  } finally {
    setSaving(false)
  }
}

  if (!currentUser) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-sm max-h-[90vh] overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Mi perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4 pr-1">
          <div className="flex flex-col items-center gap-2">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-md">
                <AvatarImage src={preview ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {fullName?.[0]?.toUpperCase() ?? <User className="h-6 w-6" />}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center
                              opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs text-primary hover:underline">
              Cambiar foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-name" className="text-sm">Nombre completo</Label>
            <Input id="pm-name" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Rol</Label>
            <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/40">
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                ROLE_STYLES[currentUser.role] ?? "bg-muted text-muted-foreground")}>
                {currentUser.role}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground italic px-1">Solo editable desde administración</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !fullName.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser } = useCurrentUser()
  const { resolvedTheme, setTheme } = useTheme()
  const [curPw,     setCurPw]     = useState("")
  const [newPw,     setNewPw]     = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [showCur,   setShowCur]   = useState(false)
  const [showNew,   setShowNew]   = useState(false)
  const [showConf,  setShowConf]  = useState(false)
  const [savingPw,  setSavingPw]  = useState(false)
  const [pwError,   setPwError]   = useState<string | null>(null)

  const match   = newPw === confirmPw
  const canSave = curPw.length > 0 && passwordValid(newPw) && match

  const reset = () => {
    setCurPw(""); setNewPw(""); setConfirmPw("")
    setShowCur(false); setShowNew(false); setShowConf(false); setPwError(null)
  }

  const changePw = async () => {
  if (!canSave || !currentUser || !auth.currentUser) return

  setSavingPw(true)
  setPwError(null)

  try {
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email!,
      curPw
    )

    await reauthenticateWithCredential(auth.currentUser, credential)
    await updatePassword(auth.currentUser, newPw)

    toast.success("Contraseña actualizada")
    reset()

  } catch (err: any) {
    if (err.code === "auth/wrong-password") {
      setPwError("Contraseña actual incorrecta")
    } else if (err.code === "auth/weak-password") {
      setPwError("Contraseña muy débil")
    } else {
      setPwError("Error al actualizar contraseña")
    }
  } finally {
    setSavingPw(false)
  }
}

  const PW_FIELDS = [
    { id: "cur",  label: "Contraseña actual",    val: curPw,     set: setCurPw,    show: showCur,  setShow: setShowCur,  auto: "current-password" as const },
    { id: "new",  label: "Nueva contraseña",     val: newPw,     set: setNewPw,    show: showNew,  setShow: setShowNew,  auto: "new-password"     as const },
    { id: "conf", label: "Confirmar contraseña", val: confirmPw, set: setConfirmPw,show: showConf, setShow: setShowConf, auto: "new-password"     as const },
  ]

  return (
    <Dialog open={open} onOpenChange={v => !v && (reset(), onClose())}>
      <DialogContent className="w-[92vw] max-w-xs max-h-[85vh] overflow-y-auto p-4 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Configuración</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Apariencia</p>
              <p className="text-xs text-muted-foreground">Elige el tema de la interfaz</p>
            </div>
             <div className="flex gap-1 p-1 bg-muted rounded-lg">
  {THEMES.map(t => {
    const active = resolvedTheme === t.value

    return (
      <button
        key={t.value}
        onClick={() => setTheme(t.value)}
        className={`flex-1 text-xs py-1.5 rounded-md transition ${
          active
            ? "bg-background shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {t.label}
      </button>
    )
  })}
</div>
          </div>

          <div className="border-t pt-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Cambiar contraseña</p>
                <p className="text-xs text-muted-foreground">Actualiza tu contraseña de acceso</p>
              </div>
              {pwError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {pwError}
                </div>
              )}
              {PW_FIELDS.map(f => (
                <div key={f.id} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <div className="relative">
                    <Input type={f.show ? "text" : "password"} value={f.val}
                      onChange={e => f.set(e.target.value)} autoComplete={f.auto}
                      className={cn("pr-10 h-9 text-sm",
                        f.id === "conf" && confirmPw.length > 0 && !match && "border-destructive")} />
                    <button type="button" onClick={() => f.setShow((v: boolean) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {f.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {f.id === "new"  && newPw.length > 0     && <PasswordStrength value={newPw} />}
                  {f.id === "conf" && confirmPw.length > 0 && !match && (
                    <p className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Las contraseñas no coinciden
                    </p>
                  )}
                </div>
              ))}
              <Button className="w-full h-9 text-sm mt-2" onClick={changePw} disabled={!canSave || savingPw}>
                {savingPw && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Actualizar contraseña
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="pt-2 border-t">
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { reset(); onClose() }}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const { currentUser, loading } = useCurrentUser()
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const logout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (e) {
      console.error(e)
    }
  }

  if (loading || !currentUser) {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition">
            <Avatar className="h-7 w-7">
              <AvatarImage src={currentUser.avatarUrl ?? undefined} />
              <AvatarFallback>
                {currentUser.fullName?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {!compact && (
              <span className="text-sm font-medium truncate max-w-[120px]">
                {currentUser.fullName}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-56 p-1.5 rounded-xl shadow-lg border bg-white dark:bg-zinc-900"
        >
          {/* Header */}
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">
              {currentUser.fullName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentUser.phone || "Sin teléfono"}
            </p>
          </div>

          <DropdownMenuSeparator />

          {/* Items */}
          <DropdownMenuItem
            onClick={() => setProfileOpen(true)}
            className="px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-muted"
          >
            Mi perfil
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setSettingsOpen(true)}
            className="px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-muted"
          >
            Configuración
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={logout}
            className="px-3 py-2 text-sm rounded-md cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
