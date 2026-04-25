"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell, Menu, Calendar, XCircle, FlaskConical, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"
import {
  getDoc, doc, query, collection, where, onSnapshot, updateDoc, writeBatch,
} from "firebase/firestore"
import { UserMenu } from "../user-menu"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface FirestoreNotification {
  id: string
  title: string
  body: string
  type: "appointment_confirmed" | "appointment_cancelled" | "lab_ready" | string
  read: boolean
  createdAt: any
}

interface DashboardHeaderProps {
  isLoaded: boolean
}

// ─── Icono según tipo ─────────────────────────────────────────────────────────
function NotifIcon({ type, read }: { type: string; read: boolean }) {
  const base = "h-5 w-5 shrink-0"
  const muted = read ? "text-muted-foreground" : ""

  if (type === "appointment_confirmed")
    return <CheckCircle2 className={cn(base, muted || "text-emerald-500")} />
  if (type === "appointment_cancelled")
    return <XCircle className={cn(base, muted || "text-red-500")} />
  if (type === "lab_ready")
    return <FlaskConical className={cn(base, muted || "text-blue-500")} />

  return <Bell className={cn(base, muted || "text-primary")} />
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function DashboardHeader({ isLoaded }: DashboardHeaderProps) {
  const [notifications, setNotifications] = useState<FirestoreNotification[]>([])
  const [userData, setUserData] = useState<{ fullName: string; role: string } | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let unsubNotifs: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      // Limpiar listener anterior si cambia el usuario
      if (unsubNotifs) { unsubNotifs(); unsubNotifs = null }

      if (!currentUser) {
        setUserData(null)
        setNotifications([])
        router.push("/login")
        return
      }

      // Datos del usuario
      getDoc(doc(db, "users", currentUser.uid))
        .then((snap) => {
          if (snap.exists()) {
            const d = snap.data()
            setUserData({ fullName: d.fullName || "Usuario", role: d.role || "Paciente" })
          }
        })
        .catch(console.error)

      // ── Listener único en la colección "notifications" ──────────────────────
      // Aquí llegan tanto las de citas (appointment_confirmed / appointment_cancelled)
      // como las de laboratorio (lab_ready) — todas escritas por recepción/admin.
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", currentUser.uid),
        where("read", "==", false),
      )

      unsubNotifs = onSnapshot(q, (snap) => {
        const items: FirestoreNotification[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FirestoreNotification, "id">),
        }))
        // Más recientes primero
        items.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0
          const tb = b.createdAt?.toMillis?.() ?? 0
          return tb - ta
        })
        setNotifications(items)
      })
    })

    return () => {
      unsubAuth()
      if (unsubNotifs) unsubNotifs()
    }
  }, [router])

  const unreadCount = notifications.length

  // Marcar una como leída en Firestore
  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await updateDoc(doc(db, "notifications", id), { read: true })
    } catch (e) {
      console.error("Error marcando notificación:", e)
    }
  }

  // Marcar todas como leídas
  const markAllRead = async () => {
    const toMark = [...notifications]
    setNotifications([])
    try {
      const batch = writeBatch(db)
      toMark.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }))
      await batch.commit()
    } catch (e) {
      console.error("Error marcando todas:", e)
    }
  }

  const formatTime = (ts: any) => {
    if (!ts) return ""
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts)
      return d.toLocaleDateString("es-MX", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    } catch { return "" }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/80 to-primary" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <div className={cn("flex items-center gap-3 opacity-0", isLoaded && "animate-fade-in-up")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground">Integra Medica</h1>
              <p className="text-xs text-muted-foreground">Portal de Pacientes</p>
            </div>
          </div>

          {/* Acciones */}
          <div className={cn("flex items-center gap-2 sm:gap-4 opacity-0", isLoaded && "animate-fade-in-up animation-delay-100")}>

            {/* Campanita */}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 hover:bg-primary/10 transition-all duration-200 group"
                >
                  <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1">
                      <span className="absolute inline-flex h-4 w-4 rounded-full bg-red-500/30 animate-ping" />
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    </div>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-80 p-0 shadow-lg">
                {/* Header del popover */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="font-semibold text-sm">
                    Notificaciones
                    {unreadCount > 0 && (
                      <span className="ml-2 text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Marcar todo leído
                    </button>
                  )}
                </div>

                {/* Lista */}
                <div className="max-h-[340px] overflow-y-auto divide-y divide-border/50">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <Bell className="h-8 w-8 opacity-20" />
                      <p className="text-sm">Sin notificaciones nuevas</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="flex gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => {
                          markAsRead(notif.id)
                          setOpen(false)
                          // Redirige según el tipo
                          if (notif.type === "lab_ready") {
                            router.push("/dashboard#lab-results-section")
                          } else{
                            router.push("/expediente")
                          }
                        }}
                      >
                        <NotifIcon type={notif.type} read={false} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-tight">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{notif.body}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTime(notif.createdAt)}</p>
                        </div>
                        {/* Punto de no leído */}
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Mobile Menu */}
            <Button variant="ghost" size="icon" className="sm:hidden hover:bg-primary/10">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </Button>

            {/* User Dropdown */}
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  )
}