"use client"

import { useState, useEffect } from "react"
import {
  FlaskConical,
  Bell,
  CheckCircle2,
  Send,
  Clock,
  BellDot,
  Loader2,
  CalendarCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { db, auth } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  limit,
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type GynLabStatus = "tomado" | "enviado" | "listo"

interface GynLabRecord {
  id: string
  examTypeName: string
  examTypeCode: string
  date: string
  status: GynLabStatus
  notifiedAt?: string
  notes?: string
}

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: any
  type: string
}

// ─── Config de estados ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<GynLabStatus, {
  label: string
  icon: React.ReactNode
  badgeClass: string
  step: number
}> = {
  tomado:  { label: "Muestra tomada",       icon: <CheckCircle2 className="h-3.5 w-3.5" />, badgeClass: "bg-amber-100 text-amber-700 border-amber-200",   step: 1 },
  enviado: { label: "En laboratorio",       icon: <Send className="h-3.5 w-3.5" />,         badgeClass: "bg-blue-100 text-blue-700 border-blue-200",     step: 2 },
  listo:   { label: "Listo para recoger",   icon: <Bell className="h-3.5 w-3.5" />,         badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200", step: 3 },
}

// ─── Barra de progreso del análisis ──────────────────────────────────────────
function LabProgress({ status }: { status: GynLabStatus }) {
  const steps = [
    { key: "tomado",  label: "Muestra tomada" },
    { key: "enviado", label: "En laboratorio" },
    { key: "listo",   label: "Listo p/ recoger" },
  ]
  const currentStep = STATUS_CONFIG[status].step

  return (
    <div className="flex items-center gap-0 mt-3">
      {steps.map((step, i) => {
        const done = STATUS_CONFIG[step.key as GynLabStatus].step <= currentStep
        const active = step.key === status
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                done
                  ? active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/40 bg-primary/10 text-primary"
                  : "border-muted-foreground/20 bg-muted text-muted-foreground"
              )}>
                <span className="text-[10px] font-bold">{i + 1}</span>
              </div>
              <span className={cn(
                "text-[9px] mt-1 text-center w-16 leading-tight",
                done ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all duration-300",
                STATUS_CONFIG[steps[i + 1].key as GynLabStatus].step <= currentStep
                  ? "bg-primary/40"
                  : "bg-muted"
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
  // Archivo donde esté tu sección de resultados (ej. LabResultsSection.tsx)
    export function LabResultsSection() {
      return (
        <section id="lab-results-section" className="scroll-mt-20">
          {/* Todo tu contenido de resultados actuales */}
          <h2 className="text-xl font-bold">Mis Resultados de Laboratorio</h2>
          {/* ... */}
        </section>
      )
    }
    
// ─── Componente principal ─────────────────────────────────────────────────────
export function GynLabPatientView() {
  const [userId, setUserId] = useState<string | null>(null)
  const [labRecords, setLabRecords] = useState<GynLabRecord[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingLabs, setLoadingLabs] = useState(true)
  const [loadingNotifs, setLoadingNotifs] = useState(true)
  const [showAllNotifs, setShowAllNotifs] = useState(false)

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUserId(user?.uid ?? null)
      if (!user) { setLoadingLabs(false); setLoadingNotifs(false) }
    })
    return () => unsub()
  }, [])

  // Lab records del paciente
  useEffect(() => {
    if (!userId) return
    const q = query(
      collection(db, "gynLabRecords"),
      where("patientId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(10)
    )
    const unsub = onSnapshot(q, snap => {
      setLabRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as GynLabRecord)))
      setLoadingLabs(false)
    })
    return () => unsub()
  }, [userId])


  // Notificaciones del paciente
  useEffect(() => {
    if (!userId) return
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(20)
    )
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)))
      setLoadingNotifs(false)
    })
    return () => unsub()
  }, [userId])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (notifId: string) => {
    await updateDoc(doc(db, "notifications", notifId), { read: true })
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read)
    await Promise.all(unread.map(n => updateDoc(doc(db, "notifications", n.id), { read: true })))
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    const d = new Date(dateStr + "T12:00:00")
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
  }

  const formatTime = (ts: any) => {
    if (!ts) return ""
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }

  const visibleNotifs = showAllNotifs ? notifications : notifications.slice(0, 3)

  return (
    <div className="space-y-5">
      {/* Notificaciones */}
      {(loadingNotifs || notifications.length > 0) && (
        <Card className={cn(
          "border-border/50 shadow-sm transition-all",
          unreadCount > 0 && "border-emerald-200/60 bg-emerald-50/30"
        )}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              {unreadCount > 0 ? (
                <BellDot className="h-5 w-5 text-emerald-600" />
              ) : (
                <Bell className="h-5 w-5 text-muted-foreground" />
              )}
              Avisos
              {unreadCount > 0 && (
                <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 h-auto">
                  {unreadCount} nuevo{unreadCount > 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={markAllRead}>
                Marcar todo como leído
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {loadingNotifs ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {visibleNotifs.map(notif => (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                      notif.read
                        ? "border-border/40 bg-muted/20"
                        : notif.type === "appointment_confirmed"
                          ? "border-blue-200 bg-white shadow-sm"
                          : "border-emerald-200 bg-white shadow-sm"
                    )}
                    onClick={() => !notif.read && markAsRead(notif.id)}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
                      notif.read
                        ? "bg-muted"
                        : notif.type === "appointment_confirmed" ? "bg-blue-100" : "bg-emerald-100"
                    )}>
                      {notif.type === "appointment_confirmed" ? (
                        <CalendarCheck className={cn("h-4 w-4", notif.read ? "text-muted-foreground" : "text-blue-600")} />
                      ) : (
                        <Bell className={cn("h-4 w-4", notif.read ? "text-muted-foreground" : "text-emerald-600")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", notif.read ? "text-muted-foreground" : "text-foreground")}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTime(notif.createdAt)}</p>
                    </div>
                    {!notif.read && (
                      <div className={cn(
                        "h-2 w-2 rounded-full shrink-0 mt-2",
                        notif.type === "appointment_confirmed" ? "bg-blue-500" : "bg-emerald-500"
                      )} />
                    )}
                  </div>
                ))}
                {notifications.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground h-7"
                    onClick={() => setShowAllNotifs(v => !v)}
                  >
                    {showAllNotifs ? "Ver menos" : `Ver ${notifications.length - 3} más`}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mis análisis */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 flex flex-row items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <FlaskConical className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base">Mis análisis</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {loadingLabs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : labRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FlaskConical className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No tienes análisis registrados</p>
            </div>
          ) : (
            labRecords.map(record => {
              const cfg = STATUS_CONFIG[record.status]
              return (
                <div
                  key={record.id}
                  className={cn(
                    "rounded-2xl border p-4 transition-all",
                    record.status === "listo"
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-border/50 bg-muted/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{record.examTypeName}</p>
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {record.examTypeCode}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(record.date)}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] border shrink-0 gap-1", cfg.badgeClass)}>
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                  </div>

                  <LabProgress status={record.status} />

                  {record.status === "listo" && (
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-100 border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <p className="text-xs text-emerald-700 font-medium">
                        Tu análisis está listo. Pasa a recogerlo a la clínica.
                      </p>
                    </div>
                  )}

                  {record.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{record.notes}</p>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}