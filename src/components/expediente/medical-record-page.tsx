"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ChevronLeft, 
  Loader2, 
  DollarSign,
  FileText,
  User,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ClipboardList,
  Search,
  Filter,
  Download,
  ChevronDown,
  History,
  Activity,
  TrendingUp
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import Link from "next/link"

import { db, auth } from "@/lib/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  where 
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, getYear, getMonth } from "date-fns"
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
  diagnosis?: string
  prescription?: string
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
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: CheckCircle2
  },
  cancelled: { 
    label: "Cancelada", 
    className: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle
  }
}

export function MedicalRecordPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())


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
        orderBy("date", "desc") 
      )

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const allAppointments = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          const docId = docSnapshot.id
          
          let jsDate: Date | null = null
          if (data.date?.toDate) {
  jsDate = data.date.toDate();
} else if (typeof data.date === "string") {
  // 💡 CORRECCIÓN: Dividir el string "YYYY-MM-DD" para evitar desfase de zona horaria
  const [year, month, day] = data.date.split("-").map(Number);
  // El mes en JS es 0-indexed (enero es 0), por eso month - 1
  jsDate = new Date(year, month - 1, day);
}

          if (!jsDate || isNaN(jsDate.getTime())) return null

          // MAPEADO DINÁMICO CON TUS NUEVOS CAMPOS
          return {
            id: docId,
            // Prioriza doctorName que guardas en el scheduler
            doctor: data.doctorName || data.doctor || "Médico por asignar",
            specialty: data.specialty || "General",
            location: data.location || "Consultorio",
            status: data.status || "completed",
            // Avatar dinámico basado en el ID del doctor
            avatar: data.doctorAvatar || "/placeholder-doctor.jpg",
            date: jsDate,
            dateUI: format(jsDate, "EEEE d 'de' MMMM, yyyy", { locale: es }),
            timeUI: data.time || "--:--",
            price: Number(data.price) || 0,
            service: data.service || "Consulta Médica",
            instructions: data.instructions || "",
            notes: data.notes || "",
            diagnosis: data.diagnosis || "",
            prescription: data.prescription || ""
          }
        }).filter(item => item !== null) as Appointment[]

        setAppointments(allAppointments)
        setLoading(false)

        if (allAppointments.length > 0) {
          const currentMonthKey = format(new Date(), "yyyy-MM")
          setExpandedMonths(new Set([currentMonthKey]))
        }
      }, (error) => {
        console.error("Error obteniendo expediente:", error)
        setLoading(false)
      })

      return () => unsubscribeSnapshot()
    })

    return () => unsubscribeAuth()
  }, [])


  // Get unique years from appointments
  const availableYears = useMemo(() => {
    const years = new Set(appointments.map(a => getYear(a.date)))
    return Array.from(years).sort((a, b) => b - a)
  }, [appointments])

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesSearch = 
        apt.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.service.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || apt.status === statusFilter
      const matchesYear = yearFilter === "all" || getYear(apt.date).toString() === yearFilter

      return matchesSearch && matchesStatus && matchesYear
    })
  }, [appointments, searchTerm, statusFilter, yearFilter])

  // Group appointments by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, Appointment[]> = {}
    
    filteredAppointments.forEach(apt => {
      const monthKey = format(apt.date, "yyyy-MM")
      if (!groups[monthKey]) {
        groups[monthKey] = []
      }
      groups[monthKey].push(apt)
    })

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredAppointments])

  // Statistics
  const stats = useMemo(() => {
  const total = appointments.length

  const completedAppointments = appointments.filter(
    (a) => a.status?.toLowerCase() === "completed"
  )

  const completed = completedAppointments.length

  const cancelled = appointments.filter(
    (a) => a.status?.toLowerCase() === "cancelled"
  ).length

  // ✅ SOLO suma citas completadas (NO canceladas, NO pendientes, NO confirmadas)
  const totalSpent = completedAppointments.reduce(
    (acc, a) => acc + (Number(a.price) || 0),
    0
  )

  return { total, completed, cancelled, totalSpent }
}, [appointments])

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey)
    } else {
      newExpanded.add(monthKey)
    }
    setExpandedMonths(newExpanded)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando tu expediente médico...</p>
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
            Inicia sesión para ver tu expediente médico completo.
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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Mi Expediente
                </h1>
                <p className="text-xs text-muted-foreground">Historial médico completo</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <History className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Citas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.cancelled}</p>
                <p className="text-xs text-muted-foreground">Canceladas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">${stats.totalSpent.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Invertido</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por doctor, especialidad o servicio..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Timeline */}
        {filteredAppointments.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-sm mx-auto">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {appointments.length === 0 
                  ? "Tu expediente está vacío" 
                  : "No hay resultados"
                }
              </h3>
              <p className="text-muted-foreground mb-6">
                {appointments.length === 0 
                  ? "Aquí aparecerá tu historial de citas médicas."
                  : "Intenta con otros filtros de búsqueda."
                }
              </p>
              {appointments.length === 0 && (
                <Link href="/agendar">
                  <Button>Agendar Primera Cita</Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedByMonth.map(([monthKey, monthAppointments]) => {
              const monthDate = new Date(monthKey + "-01")
              const monthName = format(monthDate, "MMMM yyyy", { locale: es })
              const isExpanded = expandedMonths.has(monthKey)
              
              return (
                <Collapsible 
                  key={monthKey} 
                  open={isExpanded}
                  onOpenChange={() => toggleMonth(monthKey)}
                >
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold capitalize">{monthName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {monthAppointments.length} {monthAppointments.length === 1 ? 'cita' : 'citas'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            ${monthAppointments
  .filter(a => a.status?.toLowerCase() === "completed")
  .reduce((acc, a) => acc + (Number(a.price) || 0), 0)
  .toLocaleString()}
                          </span>
                          <ChevronDown className={cn(
                            "h-5 w-5 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                          )} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="p-4 space-y-3">
                        {monthAppointments.map((appointment, index) => {
                          const statusStyle = statusConfig[appointment.status] || statusConfig.completed
                          const StatusIcon = statusStyle.icon
                          
                          return (
                            <div 
                              key={appointment.id}
                              className={cn(
                                "flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-border/50 bg-muted/20",
                                "hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer"
                              )}
                              onClick={() => setSelectedAppointment(appointment)}
                            >
                              {/* Timeline indicator */}
                              <div className="hidden sm:flex flex-col items-center gap-1">
                                <div className="text-center min-w-[50px]">
                                  <p className="text-2xl font-bold text-primary">
                                    {format(appointment.date, "d")}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {format(appointment.date, "EEE", { locale: es })}
                                  </p>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                                  <div className="flex items-center gap-2">
                                    <img 
                                      src={appointment.avatar || "/placeholder.svg"}
                                      alt={appointment.doctor}
                                      className="h-10 w-10 rounded-full object-cover border border-border"
                                    />
                                    <div>
                                      <p className="font-medium text-sm">{appointment.doctor}</p>
                                      <p className="text-xs text-muted-foreground">{appointment.specialty}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className={cn("w-fit", statusStyle.className)}>
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusStyle.label}
                                  </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Stethoscope className="h-3.5 w-3.5" />
                                    {appointment.service}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {appointment.timeUI}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {appointment.location}
                                  </span>
                                </div>

                                {appointment.diagnosis && (
                                  <div className="mt-2 p-2 bg-background rounded-lg border border-border/50">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Diagnóstico:</p>
                                    <p className="text-sm line-clamp-1">{appointment.diagnosis}</p>
                                  </div>
                                )}
                              </div>

                              {/* Price */}
                              <div className="text-right sm:min-w-[80px]">
                                <p className="text-lg font-bold">
                                  ${appointment.price.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">MXN</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })}
          </div>
        )}

        {/* Quick Link to Upcoming */}
        <div className="mt-8 text-center">
          <Link href="/citas">
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Ver Citas Próximas
            </Button>
          </Link>
        </div>
      </main>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedAppointment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Detalle de Consulta
                </DialogTitle>
                <DialogDescription>
                  {selectedAppointment.dateUI}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Doctor */}
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                  <img 
                    src={selectedAppointment.avatar || "/placeholder.svg"}
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
                    <p className="text-sm text-muted-foreground">Costo</p>
                    <p className="text-2xl font-bold text-primary">
                      ${selectedAppointment.price.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium text-sm">
                      {format(selectedAppointment.date, "d MMM yyyy", { locale: es })}
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

                {/* Diagnosis */}
                {selectedAppointment.diagnosis && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Stethoscope className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm text-blue-800">Diagnóstico</span>
                    </div>
                    <p className="text-sm text-blue-900">
                      {selectedAppointment.diagnosis}
                    </p>
                  </div>
                )}

                {/* Prescription */}
                {selectedAppointment.prescription && (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-sm text-green-800">Receta / Tratamiento</span>
                    </div>
                    <p className="text-sm text-green-900 whitespace-pre-line">
                      {selectedAppointment.prescription}
                    </p>
                  </div>
                )}

                {/* Instructions */}
                {selectedAppointment.instructions && (
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Indicaciones</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedAppointment.instructions}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {selectedAppointment.notes && (
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-sm font-medium mb-1">Notas adicionales</p>
                    <p className="text-sm text-muted-foreground">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAppointment(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
