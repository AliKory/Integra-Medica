"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, MapPin, ChevronRight, Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"

import { db, auth } from "@/lib/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  where 
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { format, isToday, isTomorrow } from "date-fns"
import { es } from "date-fns/locale"

interface AppointmentsSectionProps {
  isLoaded: boolean
}

const statusConfig: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmada", className: "bg-green-100 text-green-700 border-green-200" },
  pending: { label: "Pendiente", className: "bg-orange-100 text-orange-700 border-orange-200" },
  completed: { label: "Completada", className: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-700 border-red-200" }
}

export function AppointmentsSection({ isLoaded }: AppointmentsSectionProps) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAppointments([])
        setLoading(false)
        setIsAuthenticated(false)
        return
      }

      setIsAuthenticated(true)
      const appointmentsRef = collection(db, "appointments")
      
      const q = query(
        appointmentsRef, 
        where("userId", "==", user.uid), 
        orderBy("date", "asc")
      )

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const now = new Date()

        const allAppointments = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          const docId = docSnapshot.id
          
          let jsDate: Date | null = null
          if (data.date && typeof data.date.toDate === 'function') {
            jsDate = data.date.toDate()
          } else if (typeof data.date === "string") {
  const [year, month, day] = data.date.split("-").map(Number)
  jsDate = new Date(year, month - 1, day)  // ← hora local, sin desfase
}

          if (!jsDate || isNaN(jsDate.getTime())) return null

          const currentStatus = data.status || "pending"
          
          // Lógica de auto-completado si la hora ya pasó
          // DESPUÉS — parsing correcto AM/PM + fecha sin desfase:

          let dateLabel = ""
          if (isToday(jsDate)) dateLabel = "Hoy"
          else if (isTomorrow(jsDate)) dateLabel = "Mañana"
          else dateLabel = format(jsDate, "d MMM", { locale: es })

          // MAPEO DINÁMICO DE DATOS REALES DE LA BD
          return {
            id: docId,
            // Priorizamos doctorName que es el campo que guardas ahora
            doctor: data.doctorName || data.doctor || "Médico por asignar",
            specialty: data.specialty || "Especialidad",
            location: data.location || "Consultorio",
            status: currentStatus,
            // Generamos un avatar basado en el ID del doctor o usamos el guardado
            avatar: data.doctorAvatar,
            dateUI: dateLabel,
            timeUI: data.time || "--:--",
            originalDate: jsDate
          }
        }).filter(item => item !== null)

        const activeAppointments = allAppointments
          .filter((app: any) => app.status === 'pending' || app.status === 'confirmed')
          .slice(0, 5) // Solo mostramos las 5 más próximas en el dashboard

        setAppointments(activeAppointments)
        setLoading(false)
      }, (error) => {
        console.error("Error obteniendo citas:", error)
        setLoading(false)
      })

      return () => unsubscribeSnapshot()
    })

    return () => unsubscribeAuth()
  }, [])

  const showContent = isLoaded && !loading

  if (loading) {
    return (
      <Card className="border-border/50 shadow-sm min-h-[200px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </Card>
    )
  }

  if (!isAuthenticated) {
    return (
      <Card className="border-border/50 shadow-sm p-6 text-center">
        <p className="text-muted-foreground mb-4">Inicia sesión para ver tus citas.</p>
        <Link href="/login"><Button>Iniciar Sesión</Button></Link>
      </Card>
    )
  }

  return (
    <Card className={cn("border-border/50 shadow-sm opacity-0 transition-opacity duration-500", showContent && "opacity-100 animate-fade-in-up")}>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          Próximas Citas
        </CardTitle>
        
        <Link href="/citas"> 
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
            Ver todas
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {appointments.length === 0 ? (
          <div className="text-center py-8 flex flex-col items-center">
            <div className="bg-muted/30 p-3 rounded-full mb-3">
              <Calendar className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm mb-1">No tienes citas pendientes.</p>
            <p className="text-xs text-muted-foreground/60">¡Agenda tu próxima visita!</p>
          </div>
        ) : (
          appointments.map((appointment, index) => {
            const statusStyle = statusConfig[appointment.status] || statusConfig.pending
            return (
              <div 
                key={appointment.id}
                className={cn(
                  "group flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-4 transition-all duration-300 hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm opacity-0",
                  showContent && "animate-slide-in-right"
                )}
                style={{ animationDelay: `${100 + index * 100}ms` }}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <img 
                      src={appointment.avatar || "/placeholder.svg"} 
                      alt={appointment.doctor} 
                      className="h-12 w-12 rounded-full object-cover border-2 border-card bg-gray-200" 
                    />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card", 
                      appointment.status === "confirmed" ? "bg-green-500" : "bg-orange-400"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{appointment.doctor}</p>
                    <p className="text-sm text-muted-foreground">{appointment.specialty}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 sm:ml-auto items-center">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="capitalize">{appointment.dateUI}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{appointment.timeUI}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{appointment.location}</span>
                  </div>
                  <Badge variant="outline" className={statusStyle.className}>
                    {statusStyle.label}
                  </Badge>
                </div>
              </div>
            )
          })
        )}
        <Link 
          href="/scheduler" 
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-4 text-muted-foreground transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="h-5 w-5" /> 
          <span className="font-medium">Agendar nueva cita</span>
        </Link>
      </CardContent>
    </Card>
  )
}
