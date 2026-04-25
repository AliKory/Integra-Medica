"use client"

import { useState, useEffect } from "react"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ChevronLeft, 
  Plus, 
  Loader2, 
  DollarSign,
  FileText,
  User,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ClipboardList
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { format, isToday, isTomorrow, isPast, isFuture, parseISO } from "date-fns"
import { es } from "date-fns/locale"

interface Appointment {
  id: string
  doctor: string
  specialty: string
  location: string
  status: string
  avatar: string
  date: Date
  dateUI: string
  timeUI: string
  price: number
  service: string
  instructions: string
  notes: string
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  confirmed: { 
    label: "Confirmada", 
    className: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2
  },
  pending: { 
    label: "Pendiente", 
    className: "bg-orange-100 text-orange-700 border-orange-200",
    icon: AlertCircle
  },
  completed: { 
    label: "Completada", 
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: CheckCircle2
  },
  cancelled: { 
    label: "Cancelada", 
    className: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle
  }
}

export function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (!user) {
      setAppointments([]);
      setLoading(false);
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);
    const appointmentsRef = collection(db, "appointments");

    const q = query(
      appointmentsRef,
      where("userId", "==", user.uid),
      orderBy("date", "asc")
    );

    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      console.log("🔥 SNAPSHOT DISPARADO, docs:", snapshot.docs.length)
      snapshot.docChanges().forEach(change => {
    console.log("📄 Cambio:", change.type, change.doc.id, change.doc.data().status, change.doc.data().time, change.doc.data().date)
  })
      const now = new Date();
      
      // Usamos map y filtramos los nulls al final
      const processed = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;

        // 1. Obtener la fecha correctamente (Soporta Timestamp de Firebase y String)
        let jsDate: Date | null = null;
        if (data.date?.toDate) {
  jsDate = data.date.toDate();
} else if (typeof data.date === "string") {
  // 💡 CORRECCIÓN: Dividir el string "YYYY-MM-DD" para evitar desfase de zona horaria
  const [year, month, day] = data.date.split("-").map(Number);
  // El mes en JS es 0-indexed (enero es 0), por eso month - 1
  jsDate = new Date(year, month - 1, day);
}

        if (!jsDate || isNaN(jsDate.getTime())) return null;

        // 2. Determinar Status y Auto-completado
        const currentStatus = data.status || "pending";
        
        // Solo intentamos autocompletar si tenemos hora y es pendiente/confirmada
       // POR ESTO:

        // 3. Formatear Etiqueta de fecha
        let dateLabel = format(jsDate, "EEEE d 'de' MMMM", { locale: es });
        if (isToday(jsDate)) dateLabel = "Hoy";
        else if (isTomorrow(jsDate)) dateLabel = "Mañana";

        // 4. Retornar objeto con la estructura de la interfaz Appointment
        return {
          id,
          doctor: data.doctorName || data.doctor || "Dr. Omar Lorenzo Cruz",
          specialty: data.specialty || "Ginecología",
          location: data.location || "Consultorio 1",
          status: currentStatus,
          avatar: data.doctorAvatar,
          date: jsDate, // Guardamos el objeto Date real
          dateUI: dateLabel,
          timeUI: data.time || "--:--",
          price: Number(data.price) || 500,
          service: data.service || "Consulta",
          instructions: data.instructions || "Sin indicaciones adicionales.",
          notes: data.notes || ""
        };
      }).filter((item): item is Appointment => item !== null);

      // 5. Filtrar solo las que queremos mostrar como "Próximas"
      const upcoming = processed.filter(
        (a) => a.status === "pending" || a.status === "confirmed"
      );

      setAppointments(upcoming);
      setLoading(false);
    }, (error) => {
      console.error("Error en Snapshot:", error);
      setLoading(false);
    });
  });

  return () => {
    unsubscribeAuth();
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}, []);

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return
    
    setCancelling(true)
    try {
      const docRef = doc(db, "appointments", appointmentToCancel)
      await updateDoc(docRef, { status: 'cancelled' })
      setShowCancelDialog(false)
      setAppointmentToCancel(null)
    } catch (error) {
      console.error("Error cancelando cita:", error)
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando tus citas...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <User className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso Requerido</h2>
          <p className="text-muted-foreground mb-6">
            Inicia sesión para ver tus citas programadas.
          </p>
          <Link href="/login">
            <Button className="w-full">Iniciar Sesión</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold">Mis Citas</h1>
                <p className="text-xs text-muted-foreground">Próximas consultas programadas</p>
              </div>
            </div>
            <Link href="/scheduler">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva Cita</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl py-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{appointments.length}</p>
                <p className="text-xs text-muted-foreground">Próximas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => a.status === 'confirmed').length}
                </p>
                <p className="text-xs text-muted-foreground">Confirmadas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => a.status === 'pending').length}
                </p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${appointments.reduce((acc, a) => acc + a.price, 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Appointments List */}
        {appointments.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-sm mx-auto">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No tienes citas próximas</h3>
              <p className="text-muted-foreground mb-6">
                Agenda tu próxima consulta médica y mantén tu salud al día.
              </p>
              <Link href="/scheduler">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agendar Cita
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment, index) => {
              const statusStyle = statusConfig[appointment.status] || statusConfig.pending
              const StatusIcon = statusStyle.icon
              
              return (
                <Card 
                  key={appointment.id}
                  className={cn(
                    "overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer group",
                    "opacity-0 animate-fade-in-up"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => setSelectedAppointment(appointment)}
                >
                  <div className="flex flex-col lg:flex-row">
                    {/* Left: Date Indicator */}
                    <div className="bg-primary/5 p-4 lg:p-6 lg:w-40 flex lg:flex-col items-center lg:items-center justify-between lg:justify-center gap-2 border-b lg:border-b-0 lg:border-r border-border/50">
                      <div className="text-center">
                        <p className="text-3xl lg:text-4xl font-bold text-primary">
                          {format(appointment.date, "d")}
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {format(appointment.date, "MMMM", { locale: es })}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("lg:mt-2", statusStyle.className)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusStyle.label}
                      </Badge>
                    </div>

                    {/* Right: Details */}
                    <div className="flex-1 p-4 lg:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        {/* Doctor Info */}
                        <div className="flex items-center gap-3 flex-1">
                          <img 
                            src={appointment.avatar || "/placeholder.svg"} 
                            alt={appointment.doctor}
                            className="h-14 w-14 rounded-full object-cover border-2 border-card shadow-sm"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate">
                              {appointment.doctor}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Stethoscope className="h-3.5 w-3.5" />
                              {appointment.specialty}
                            </p>
                            <p className="text-sm text-primary font-medium mt-1">
                              {appointment.service}
                            </p>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">
                            ${appointment.price.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">MXN</p>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Fecha</p>
                            <p className="font-medium capitalize">{appointment.dateUI}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Hora</p>
                            <p className="font-medium">{appointment.timeUI}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Ubicación</p>
                            <p className="font-medium">{appointment.location}</p>
                          </div>
                        </div>
                      </div>

                      {/* Instructions Preview */}
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Indicaciones</p>
                            <p className="text-sm text-foreground line-clamp-2">
                              {appointment.instructions}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAppointment(appointment)
                          }}
                        >
                          Ver Detalles
                        </Button>
                        {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAppointmentToCancel(appointment.id)
                              setShowCancelDialog(true)
                            }}
                          >
                            Cancelar Cita
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Link to History */}
        <div className="mt-8 text-center">
          <Link href="/expediente">
            <Button variant="outline" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Ver Historial Completo (Expediente)
            </Button>
          </Link>
        </div>
      </main>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-lg">
          {selectedAppointment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Detalle de Cita
                </DialogTitle>
                <DialogDescription>
                  {format(selectedAppointment.date, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Doctor */}
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                  <img 
                    src={selectedAppointment.avatar }
                    alt={selectedAppointment.doctor}
                    className="h-16 w-16 rounded-full object-cover border-2 border-card"
                  />
                  <div>
                    <h4 className="font-semibold">{selectedAppointment.doctor}</h4>
                    <p className="text-sm text-muted-foreground">{selectedAppointment.specialty}</p>
                    <Badge 
                      variant="outline" 
                      className={cn("mt-2", statusConfig[selectedAppointment.status].className)}
                    >
                      {statusConfig[selectedAppointment.status].label}
                    </Badge>
                  </div>
                </div>

                {/* Service & Price */}
                <div className="flex justify-between items-center p-4 border rounded-xl">
                  <div>
                    <p className="text-sm text-muted-foreground">Servicio</p>
                    <p className="font-medium">{selectedAppointment.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Precio</p>
                    <p className="text-2xl font-bold text-primary">
                      ${selectedAppointment.price.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium text-sm">
                      {format(selectedAppointment.date, "d MMM", { locale: es })}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">Hora</p>
                    <p className="font-medium text-sm">{selectedAppointment.timeUI}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <MapPin className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">Lugar</p>
                    <p className="font-medium text-sm">{selectedAppointment.location}</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Indicaciones Importantes</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedAppointment.instructions}
                  </p>
                </div>

                {selectedAppointment.notes && (
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-sm font-medium mb-1">Notas adicionales</p>
                    <p className="text-sm text-muted-foreground">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && (
                  <Button 
                    variant="outline" 
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      setAppointmentToCancel(selectedAppointment.id)
                      setSelectedAppointment(null)
                      setShowCancelDialog(true)
                    }}
                  >
                    Cancelar Cita
                  </Button>
                )}
                <Button onClick={() => setSelectedAppointment(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La cita será marcada como cancelada y 
              el horario quedará disponible para otros pacientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>No, mantener cita</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelAppointment}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelando...
                </>
              ) : (
                "Sí, cancelar cita"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}