"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
   Clock,  Search,  Phone, CheckCircle2, XCircle,
  Edit3, ChevronLeft, ChevronRight, CalendarClock,
  User, Loader2, ChevronDown, 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { db } from "@/lib/firebase"
import {
  collection, query, where, orderBy, onSnapshot,
  updateDoc, doc, getDocs, addDoc, serverTimestamp,
} from "firebase/firestore"
import { FloatingActions } from "./floating-actions"

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientPhone: string         
  doctorId: string
  doctorName: string
  specialty: string
  serviceId: string
  serviceName: string
  date: string
  time: string
  location: string
  status: "confirmed" | "pending" | "cancelled" | "completed"
  type: "scheduled" | "walk-in" | "call"
  price: number
  createdAt?: any
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  confirmed: { label: "Confirmada", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  pending:   { label: "Pendiente",  color: "bg-amber-100 text-amber-700 border-amber-200",       icon: <CalendarClock className="h-3.5 w-3.5" /> },
  cancelled: { label: "Cancelada",  color: "bg-red-100 text-red-700 border-red-200",             icon: <XCircle className="h-3.5 w-3.5" /> },
  completed: { label: "Completada", color: "bg-blue-100 text-blue-700 border-blue-200",          icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
}

export function AppointmentsManagement() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const todayLocal = new Date()
  const [filterDate, setFilterDate] = useState(
    `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  const [editOpen, setEditOpen] = useState(false)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)

  // Listener principal de citas
  useEffect(() => {
    setLoading(true)

    const q = query(
      collection(db, "appointments"),
      orderBy("date", "asc"),
      orderBy("time", "asc")
    )

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const now = new Date()

        let allData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Appointment[]

        // Auto-completar citas pasadas
        const autoCompletePromises = snapshot.docs
          .filter(d => {
            const apt = d.data() as Appointment
            if (apt.status === "cancelled" || apt.status === "completed") return false
            const aptDateTime = parseAppointmentDateTime(apt.date, apt.time)
            return aptDateTime && aptDateTime < now
          })
          .map(d => updateDoc(d.ref, { status: "completed" }))

        if (autoCompletePromises.length > 0) {
          await Promise.all(autoCompletePromises)
          return // Se volverá a disparar el snapshot
        }

        // Filtrar por fecha seleccionada
        const filteredByDate = allData.filter((apt) => apt.date === filterDate)
        setAppointments(filteredByDate)
      } catch (err) {
        console.error("Error en listener de citas:", err)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [filterDate])

  // Cargar datos auxiliares
  // Reemplaza todo tu useEffect de loadData por esto:

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true); // si tienes este estado

      const [pSnap, dSnap, catSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "PACIENTE"))),
        getDocs(collection(db, "doctors")),
        getDocs(collection(db, "serviceCategories")),
      ]);

      setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDoctors(dSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // ── Carga profunda de servicios (mejorada) ─────────────────────────────
      const servicesPromises = catSnap.docs.map(async (catDoc) => {
        const catData = catDoc.data();
        const catId = catDoc.id;
        const catName = catData.name || "Sin categoría";

        try {
          const servicesSnap = await getDocs(
            collection(db, "serviceCategories", catId, "services")
          );

          return servicesSnap.docs.map((serviceDoc) => ({
            id: serviceDoc.id,
            categoryId: catId,
            categoryName: catName,
            ...serviceDoc.data(),
          }));
        } catch (subError) {
          console.warn(`Error cargando servicios de categoría ${catName} (${catId}):`, subError);
          return []; // Si falla una categoría, no rompe todo
        }
      });

      const allServicesArrays = await Promise.all(servicesPromises);
      const flatServices = allServicesArrays.flat();

      console.log(`✅ Total de servicios cargados: ${flatServices.length}`);
      console.table(flatServices.slice(0, 10)); // Muestra los primeros 10 para debug

      setServices(flatServices);

    } catch (error) {
      console.error("Error general al cargar datos auxiliares:", error);
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "appointments", id), { status: newStatus })

      // Notificar al paciente cuando su cita es confirmada
      if (newStatus === "confirmed") {
        const apt = appointments.find(a => a.id === id)
        if (apt?.patientId) {
          await addDoc(collection(db, "notifications"), {
            userId: apt.patientId,
            type: "appointment_confirmed",
            title: "Cita confirmada",
            body: `Tu cita del ${apt.date} a las ${apt.time} con ${apt.doctorName} ha sido confirmada.`,
            read: false,
            createdAt: serverTimestamp(),
            appointmentId: id,
          })
        }
      }
    } catch (e) {
      console.error("Error al actualizar estado:", e)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedApt) return
    setSaving(true)
    try {
      const { id, ...dataToUpdate } = selectedApt
      await updateDoc(doc(db, "appointments", id), dataToUpdate)
      setEditOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      const matchSearch = 
        a.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.patientPhone && a.patientPhone.includes(searchQuery))
      
      const matchStatus = filterStatus === "all" || a.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [appointments, searchQuery, filterStatus])

  // Función auxiliar (la tenías fuera)
  const parseAppointmentDateTime = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number)
      const [time, modifier] = timeStr.trim().split(" ")
      let [hours, minutes] = time.split(":").map(Number)

      if (modifier === "PM" && hours !== 12) hours += 12
      if (modifier === "AM" && hours === 12) hours = 0

      return new Date(year, month - 1, day, hours, minutes)
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controles */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            const [y, m, day] = filterDate.split('-').map(Number)
            const d = new Date(y, m - 1, day)
            d.setDate(d.getDate() - 1)
            setFilterDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[220px] text-center font-bold text-primary">
            {(() => {
              const [y, m, d] = filterDate.split('-').map(Number)
              return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })
            })()}
          </div>
          <Button variant="outline" size="icon" onClick={() => {
            const [y, m, day] = filterDate.split('-').map(Number)
            const d = new Date(y, m - 1, day)
            d.setDate(d.getDate() + 1)
            setFilterDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar paciente, doctor o teléfono..." 
              className="pl-9" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="confirmed">Confirmadas</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Citas */}
      <div className="grid gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
            No hay citas para este día
          </div>
        ) : (
          filtered.map((apt) => (
            <div 
              key={apt.id} 
              className="flex flex-col md:flex-row items-start md:items-center gap-4 p-5 bg-card border border-border/50 rounded-2xl hover:shadow-md transition-all group"
            >
              {/* Hora */}
              <div className="bg-primary/10 text-primary p-4 rounded-xl text-center min-w-[85px]">
                <Clock className="h-5 w-5 mx-auto mb-1" />
                <span className="text-lg font-bold block">{apt.time}</span>
              </div>

              {/* Información del Paciente */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h4 className="font-semibold text-lg text-foreground">{apt.patientName}</h4>
                  {apt.patientPhone && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{apt.patientPhone}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {apt.doctorName} • {apt.specialty}
                </div>
                
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs">
                    {apt.serviceName}
                  </Badge>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={cn("rounded-full gap-2", statusConfig[apt.status]?.color)}
                    >
                      {statusConfig[apt.status]?.icon}
                      {statusConfig[apt.status]?.label}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(statusConfig).map(([key, val]) => (
                      <DropdownMenuItem 
                        key={key} 
                        onClick={() => updateStatus(apt.id, key)} 
                        className="gap-2"
                      >
                        {val.icon} {val.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    setSelectedApt(apt)
                    setEditOpen(true)
                  }}
                >
                  <Edit3 className="h-4 w-4 text-primary" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Edición */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Detalles de la Cita</DialogTitle>
          </DialogHeader>

          {selectedApt && (
            <form onSubmit={handleSaveEdit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del Paciente</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-9"
                      value={selectedApt.patientName} 
                      onChange={(e) => setSelectedApt({...selectedApt, patientName: e.target.value})}
                    />
                  </div>
                </div>

                {/* Campo: Teléfono */}
    <div className="space-y-2">
      <Label>Teléfono</Label>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          className="pl-9"
          value={selectedApt.patientPhone} 
          onChange={(e) => setSelectedApt({...selectedApt, patientPhone: e.target.value})}
        />
      </div>
    </div>

  {/* Campo: Selección de Servicio Optimizado */}
<div className="space-y-0 md:col-span-2">
  <Label className="text-sm font-semibold">Servicio y Especialidad</Label>
  <Select 
    value={selectedApt.serviceId} 
    onValueChange={(value) => {
      const srv = services.find(s => s.id === value);
      if (srv) {
        setSelectedApt({
          ...selectedApt,
          serviceId: value,
          serviceName: srv.name,
          price: srv.price
        });
      }
    }}
  >
    <SelectTrigger className="w-full bg-background border-primary/20 hover:border-primary transition-colors h-10">
      <SelectValue placeholder="Busca o selecciona un servicio" />
    </SelectTrigger>
    
    {/* Ajustamos el Content con position popper para evitar saltos visuales */}
    <SelectContent 
      position="popper" 
      sideOffset={5}
      className="max-h-[300px] w-[350px] md:w-[500px] p-0"
    >
      {/* Contenedor con scroll único */}
      <div className="overflow-y-auto max-h-[300px] custom-scrollbar">
        
        {/* BUSCADOR: Al no ser 'sticky', desaparecerá al hacer scroll hacia abajo */}
        <div className="flex items-center px-3 py-2 border-b bg-muted/30">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input 
            placeholder="Filtrar servicios..." 
            className="flex h-9 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(e) => {
              const term = e.target.value.toLowerCase();
              const items = document.querySelectorAll('.service-item');
              const categories = document.querySelectorAll('.category-group');

              items.forEach((item: any) => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(term) ? "flex" : "none";
              });

              // Ocultar categorías vacías opcionalmente
              categories.forEach((cat: any) => {
                const visibleItems = cat.querySelectorAll('.service-item[style*="display: flex"]');
                cat.style.display = visibleItems.length === 0 && term !== "" ? "none" : "block";
              });
            }}
          />
        </div>

        {/* LISTADO */}
        <div className="p-1">
          {Array.from(new Set(services.map(s => s.categoryName))).map((catName) => (
            <div key={catName} className="mb-2 category-group">
              <h4 className="px-2 py-1 text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/5 rounded-sm">
                {catName}
              </h4>
              {services
                .filter(srv => srv.categoryName === catName)
                .map((srv) => (
                  <SelectItem 
                    key={srv.id} 
                    value={srv.id}
                    className="service-item cursor-pointer ml-1 mt-1 rounded-md"
                  >
                    <div className="flex justify-between items-center w-full gap-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{srv.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {srv.duration} min • ${srv.price}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
            </div>
          ))}
        </div>
      </div>
    </SelectContent>
  </Select>
</div>

    {/* Campo: Médico (Opcional por si quieres cambiarlo también) */}
    <div className="space-y-2">
      <Label>Médico Asignado</Label>
      <Select 
        value={selectedApt.doctorId} 
        onValueChange={(value) => {
          const doc = doctors.find(d => d.id === value);
          setSelectedApt({
            ...selectedApt, 
            doctorId: value, 
            doctorName: doc?.name || selectedApt.doctorName 
          });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Médico" />
        </SelectTrigger>
        <SelectContent>
          {doctors.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* Mostrar Precio Actual (Solo lectura o editable) */}
    <div className="space-y-2">
      <Label>Precio del Servicio ($)</Label>
      <Input 
        type="number"
        value={selectedApt.price} 
        onChange={(e) => setSelectedApt({...selectedApt, price: Number(e.target.value)})}
      />
    </div>
  </div>

              {/* Resto de campos... */}
              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="animate-spin h-4 w-4 mr-2" />} 
                  Actualizar Cita
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <FloatingActions isLoaded={true} />
    </div>
  )
}