"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { format, addMonths, subMonths, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { CustomCalendar } from "./custom-calendar"
import { TimeSlots } from "./time-slots"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  AlertCircle,
  Search,
  UserCheck,
  UserPlus,
  Phone,
  X,
  User,
} from "lucide-react"
import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Service {
  id: string
  name: string
  price: number | string
  duration?: number
  note?: string
  group?: string
  priceMax?: number
  priceVariable?: boolean
}

interface SubGroup {
  title: string
  items: Service[]
}

interface Category {
  id: string
  name: string
  icon: string
  description: string
  requiresLateHour: boolean
  services?: Service[]
  subGroups?: SubGroup[]
}

interface FoundPatient {
  id: string
  fullName: string
  phone: string
  role?: string
}

interface Doctor {
  name: string
  specialty: string
  avatar?: string
  isDefault?: boolean
  // puedes agregar más campos después: phone, email, etc.
}

interface DefaultDoctor {
  id: string
  name: string
  specialty: string
  avatar: string
  isDefault?: boolean
}

// ─── Session ID (SSR-safe) ────────────────────────────────────────────────────
const getSessionId = () => {
  if (typeof window === "undefined") return `ssr_${Math.random().toString(36).substr(2, 9)}`
  let id = sessionStorage.getItem("recepcionSessionId")
  if (!id) {
    id = `recep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem("recepcionSessionId", id)
  }
  return id
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SchedulerRecepcion() {
  // Calendar & time
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Services
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  // Availability
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set())
  const [tempBlockedSlots, setTempBlockedSlots] = useState<Set<string>>(new Set())
  const [myTempBlockId, setMyTempBlockId] = useState<string | null>(null)

  // Doctor
  const [defaultDoctor, setDefaultDoctor] = useState<{
  id: string
  name: string
  specialty: string
  avatar: string  
} | null>(null)

  // ── Patient lookup (the key difference vs. patient scheduler) ──
  const [phoneInput, setPhoneInput] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [foundPatient, setFoundPatient] = useState<FoundPatient | null>(null)
  const [foundPatients, setFoundPatients] = useState<FoundPatient[]>([])
  // null = not searched yet | "not_found" = searched, no match | FoundPatient = matched
  const [searchResult, setSearchResult] = useState<"idle" | "found" | "multiple" | "not_found">("idle")

  // UI states
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)

  // Refs for temp block (stale-closure safe)
  const sessionId = useRef(getSessionId())
  const tempBlockTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const myTempBlockIdRef = useRef<string | null>(null)

useEffect(() => {
  if (phoneInput.trim().length >= 10 && !foundPatient) {
    const timeout = setTimeout(() => {
      handleSearchPatient()
    }, 600)

    return () => clearTimeout(timeout)
  }
}, [phoneInput])

  // ── Load default doctor ───────────────────────────────────────────────────
useEffect(() => {
  const loadDefaultDoctor = async () => {
    try {
      const q = query(
        collection(db, "doctors"),
        where("isDefault", "==", true)
      )

      const snap = await getDocs(q)

      if (!snap.empty) {
        const docSnap = snap.docs[0]
        const d = docSnap.data()

        setDefaultDoctor({
          id: docSnap.id,
          name: d.name || "Doctor Principal",
          specialty: d.specialty || "Medicina General",
          avatar: d.avatar || "/male-doctor-portrait-professional.png",
        })
        return
      }

      // Fallback: primer doctor disponible
      const allDocs = await getDocs(collection(db, "doctors"))
      if (!allDocs.empty) {
        const first = allDocs.docs[0]
        const d = first.data()

        setDefaultDoctor({
          id: first.id,
          name: d.name || "Doctor Principal",
          specialty: d.specialty || "Medicina General",
          avatar: d.avatar || "/male-doctor-portrait-professional.png",
        })
        return
      }

      // Último fallback
      setDefaultDoctor({
        id: "sin_asignar",
        name: "Por asignar",
        specialty: "Medicina General",
        avatar: "/male-doctor-portrait-professional.png",
      })
    } catch (error) {
      console.error("Error al cargar doctor por defecto:", error)
      setDefaultDoctor({
        id: "sin_asignar",
        name: "Por asignar",
        specialty: "Medicina General",
        avatar: "/male-doctor-portrait-professional.png",
      })
    }
  }

  loadDefaultDoctor()
}, [])

  // ── Load categories & services ────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        setIsLoading(true)
        const snap = await getDocs(collection(db, "serviceCategories"))
        const data = await Promise.all(
          snap.docs.map(async (catDoc) => {
            const catData = catDoc.data()
            const servSnap = await getDocs(collection(db, "serviceCategories", catDoc.id, "services"))
            const services = servSnap.docs.map(s => ({ id: s.id, ...s.data() })) as Service[]
            const withGroup = services.filter(s => s.group)
            if (withGroup.length > 0) {
              const groups: Record<string, SubGroup> = {}
              services.forEach(s => {
                const g = s.group || "General"
                if (!groups[g]) groups[g] = { title: g, items: [] }
                groups[g].items.push(s)
              })
              return { id: catDoc.id, ...catData, subGroups: Object.values(groups) } as Category
            }
            return { id: catDoc.id, ...catData, services } as Category
          })
        )
        setCategories(data)
      } catch (e) {
        console.error("Error categorías:", e)
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [])

  // ── Load available times ──────────────────────────────────────────────────
  useEffect(() => {
    getDoc(doc(db, "config", "availableTimes"))
      .then(snap => { if (snap.exists()) setAvailableTimes(snap.data().slots || []) })
      .catch(console.error)
  }, [])

  // ── Booked slots — realtime ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDay) { setBookedSlots(new Set()); return }
    const dateStr = format(selectedDay, "yyyy-MM-dd");
    const q = query(collection(db, "appointments"), where("date", "==", dateStr), where("status", "!=", "cancelled"))
    const unsub = onSnapshot(q, snap => setBookedSlots(new Set(snap.docs.map(d => d.data().time))))
    return () => unsub()
  }, [selectedDay])

  // ── Temp blocks — realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDay) { setTempBlockedSlots(new Set()); return }
    const dateStr = format(selectedDay, "yyyy-MM-dd")

    const q = query(
  collection(db, "tempTimeBlocks"), 
  where("date", "==", dateStr), 
  where("expiresAt", ">", Timestamp.now()) // <-- Verifica que el reloj del servidor y cliente coincidan
)
    const unsub = onSnapshot(q, snap => {
      const blocked = new Set<string>()
      snap.docs.forEach(d => {
        if (d.data().userId !== sessionId.current && d.data().date === dateStr) blocked.add(d.data().time)
      })
      setTempBlockedSlots(blocked)
    })
    return () => unsub()
  }, [selectedDay])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (myTempBlockIdRef.current) removeTempBlock()
      if (tempBlockTimeoutRef.current) clearTimeout(tempBlockTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Temp block helpers ────────────────────────────────────────────────────
  const removeTempBlock = async () => {
    const id = myTempBlockIdRef.current
    if (!id) return
    try {
      await deleteDoc(doc(db, "tempTimeBlocks", id))
      setMyTempBlockId(null)
      myTempBlockIdRef.current = null
      if (tempBlockTimeoutRef.current) { clearTimeout(tempBlockTimeoutRef.current); tempBlockTimeoutRef.current = null }
    } catch (e) { console.error("Error removeTempBlock:", e) }
  }

  const createTempBlock = async (time: string) => {
    if (!selectedDay) return
    try {
      const dateStr = format(selectedDay, "yyyy-MM-dd");
      const existing = await getDocs(query(
        collection(db, "tempTimeBlocks"),
        where("date", "==", dateStr),
        where("time", "==", time),
        where("expiresAt", ">", Timestamp.now())
      ))
      if (!existing.empty && existing.docs.find(d => d.data().userId !== sessionId.current)) {
        setSelectedTime(null)
        toast.error("Horario ocupado", { description: "Ese horario acaba de ser tomado. Elige otro." })
        return
      }
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000))
      const ref = await addDoc(collection(db, "tempTimeBlocks"), { date: dateStr, time, userId: sessionId.current, expiresAt, createdAt: serverTimestamp() })
      setMyTempBlockId(ref.id)
      myTempBlockIdRef.current = ref.id
      if (tempBlockTimeoutRef.current) clearTimeout(tempBlockTimeoutRef.current)
      tempBlockTimeoutRef.current = setTimeout(removeTempBlock, 5 * 60 * 1000)
    } catch (e) { console.error("Error createTempBlock:", e) }
  }

  // ── Time helpers ──────────────────────────────────────────────────────────
  const isLateHour = (timeStr: string | null) => {
    if (!timeStr) return false
    const [time, mod] = timeStr.split(" ")
    let [h, m] = time.split(":").map(Number)
    if (mod === "PM" && h !== 12) h += 12
    if (mod === "AM" && h === 12) h = 0
    return h * 60 + m >= 16 * 60 + 30
  }

  const getFilteredTimes = () => {
  if (!selectedDay) return availableTimes

  const today = new Date()
  const isToday =
    selectedDay.getFullYear() === today.getFullYear() &&
    selectedDay.getMonth() === today.getMonth() &&
    selectedDay.getDate() === today.getDate()

  // Solo filtrar horarios pasados si es hoy.
  // NO filtrar bookedSlots ni tempBlockedSlots aqui — TimeSlots
  // los recibe por prop y los marca visualmente como ocupados/bloqueados.
  if (!isToday) return availableTimes

  const nowMin = today.getHours() * 60 + today.getMinutes()

  return availableTimes.filter(t => {
    const [time, mod] = t.split(" ")
    let [h, m] = time.split(":").map(Number)
    if (mod === "PM" && h !== 12) h += 12
    if (mod === "AM" && h === 12) h = 0
    const slotMin = h * 60 + m
    // Solo eliminar horas ya pasadas
    return slotMin > nowMin
  })
}

  const isTimeSuitableForCategory = (cat: Category) => !cat.requiresLateHour || isLateHour(selectedTime)

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTimeSelect = async (time: string) => {
    if (myTempBlockId) await removeTempBlock()
    setSelectedTime(time)
    setSelectedCategory(null)
    setSelectedService(null)
    setSaveError(null)
    await createTempBlock(time)
  }

  // ── Patient search by phone or name ──────────────────────────────────────
  const handleSearchPatient = async () => {
  const phone = phoneInput.trim()
  const name = nameInput.trim()

  if (!phone && !name) return

  setIsSearching(true)
  setFoundPatient(null)
  setFoundPatients([])
  setSearchResult("idle")

  try {
    let patients: FoundPatient[] = []

    // Buscar primero por teléfono si existe
    if (phone) {
      const phoneQuery = query(collection(db, "users"), where("phone", "==", phone))
      const phoneSnap = await getDocs(phoneQuery)

      if (!phoneSnap.empty) {
        patients = phoneSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            fullName: data.fullName || "",
            phone: data.phone || "",
            role: data.role,
          } as FoundPatient
        })
      }
    }

    // Si no encontró por teléfono, buscar por nombre
    if (patients.length === 0 && name) {
      const nameEnd = name + "\uf8ff"
      const nameQuery = query(
        collection(db, "users"),
        where("fullName", ">=", name),
        where("fullName", "<=", nameEnd)
      )
      const nameSnap = await getDocs(nameQuery)

      if (!nameSnap.empty) {
        patients = nameSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            fullName: data.fullName || "",
            phone: data.phone || "",
            role: data.role,
          } as FoundPatient
        })
      }
    }

    if (patients.length === 1) {
      setFoundPatient(patients[0])
      setNameInput(patients[0].fullName || nameInput)
      setPhoneInput(patients[0].phone || phoneInput)
      setSearchResult("found")
    } else if (patients.length > 1) {
      setFoundPatients(patients)
      setSearchResult("multiple")
    } else {
      setSearchResult("not_found")
      setFoundPatient(null)
    }
  } catch (e) {
    console.error("Error buscando paciente:", e)
    toast.error("Error al buscar paciente")
  } finally {
    setIsSearching(false)
  }
}

  const handleClearPatient = () => {
  setFoundPatient(null)
  setFoundPatients([])
  setSearchResult("idle")
  setPhoneInput("")
  setNameInput("")
}

  // ── Confirm appointment ───────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selectedDay || !selectedTime || !selectedService || !selectedCategory || !defaultDoctor) return

    // Determine patient data — must match the derived values used in canConfirm
    const finalName = foundPatient ? foundPatient.fullName : nameInput.trim()
const finalPhone = foundPatient ? foundPatient.phone : phoneInput.trim()
const finalPatientId = foundPatient?.id || null

    if (!finalName || !finalPhone) return

    try {
      setIsSaving(true)
      setSaveError(null)

      await addDoc(collection(db, "appointments"), {
        patientId:    finalPatientId || `walk_in_${Date.now()}`,
        patientName:  finalName,
        patientPhone: finalPhone,

        doctorId:   defaultDoctor.id,
        doctorName: defaultDoctor.name,
        doctorAvatar: defaultDoctor.avatar || "/male-doctor-portrait-professional.png",
        specialty:  defaultDoctor.specialty,

        serviceId:   selectedService.id,
        serviceName: selectedService.name,

        date:     format(selectedDay, "yyyy-MM-dd"),
        time:     selectedTime,
        location: "Consultorio 1",

        status: "pending",
        type:   "scheduled" as const,

        price: typeof selectedService.price === "number"
          ? selectedService.price
          : parseInt(selectedService.price as string) || 0,

        categoryId:       selectedCategory.id,
        categoryName:     selectedCategory.name,
        serviceDuration:  selectedService.duration || null,
        serviceNote:      selectedService.note || null,
        requiresLateHour: selectedCategory.requiresLateHour || false,

        // Link to existing patient if found, otherwise null (walk-in/guest)
        userId:          finalPatientId,
        registeredInDb:  !!finalPatientId,

        createdBy:  "recepcion",
        createdAt:  serverTimestamp(),
      })

      await removeTempBlock()
      setIsConfirmed(true)
    } catch (e) {
      console.error("Error guardando cita:", e)
      setSaveError("Error al agendar la cita. Intenta de nuevo.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
  await removeTempBlock()
  setSelectedDay(null)
  setSelectedTime(null)
  setSelectedCategory(null)
  setSelectedService(null)
  setIsConfirmed(false)
  setPhoneInput("")
  setNameInput("")
  setFoundPatient(null)
  setFoundPatients([])
  setSearchResult("idle")
  setSaveError(null)
}

  // ── Derived ───────────────────────────────────────────────────────────────
  const finalName = foundPatient ? foundPatient.fullName : nameInput.trim()
const finalPhone = foundPatient ? foundPatient.phone : phoneInput.trim()

const canConfirm =
  !!selectedDay &&
  !!selectedTime &&
  !!selectedService &&
  !!defaultDoctor &&
  !!finalName &&
  !!finalPhone &&
  !isSaving

  // ─────────────────────────────────────────────────────────────────────────
  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando servicios...</p>
        </div>
      </div>
    )
  }

  // Confirmation screen
  if (isConfirmed && selectedDay && selectedTime && selectedService && selectedCategory) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 text-center w-full max-w-lg animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Cita Registrada</h1>
          <p className="text-muted-foreground mb-8">La cita fue agendada correctamente</p>

          <div className="bg-muted/50 rounded-xl p-6 mb-8 text-left space-y-3">
            {[
              ["Paciente",  finalName],
              ["Teléfono",  finalPhone],
              ["Servicio",  selectedService.name],
              ["Fecha",     format(selectedDay, "EEEE, d MMMM yyyy", { locale: es })],
              ["Hora",      selectedTime],
              ["Doctor",    defaultDoctor?.name ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-right capitalize">{value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-muted-foreground text-sm">Precio</span>
              <span className="font-bold text-lg text-primary">
                ${typeof selectedService.price === "number" ? selectedService.price.toLocaleString() : selectedService.price}
              </span>
            </div>
            {/* Badge: linked to existing patient or walk-in */}
            <div className="pt-1">
              {foundPatient ? (
                <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                  <UserCheck className="w-3 h-3" /> Paciente encontrado en BD
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                  <UserPlus className="w-3 h-3" /> Paciente sin cuenta registrada
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 bg-transparent" onClick={handleReset}>
              Agendar otra cita
            </Button>
            <Button 
    variant="outline" 
    className="flex-1 border-destructive text-destructive hover:bg-destructive/10" 
    onClick={() => router.push('/recepcion')} 
  >
    Volver
  </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main scheduler UI ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
       <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b shadow-sm">
              <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                  <Link href="/recepcion">
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-foreground">Agenda Recepción</h1>
                    <p className="text-sm text-muted-foreground">Selecciona fecha, hora y servicio</p>
                  </div>
                </div>
              </div>
            </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* ── Paso 1: Paciente ────────────────────────────────────────────── */}
<div className="bg-card rounded-2xl shadow-lg p-6 animate-in fade-in slide-in-from-top duration-500">
  <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
    <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">1</span>
    Datos del paciente
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl">
    {/* Nombre */}
    <div className="relative md:col-span-2">
      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={nameInput}
        onChange={(e) => {
          setNameInput(e.target.value)
          if (searchResult !== "idle") {
            setFoundPatient(null)
            setFoundPatients([])
            setSearchResult("idle")
          }
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSearchPatient()}
        placeholder="Nombre completo *"
        className="w-full pl-9 pr-4 py-2.5 border-2 border-muted rounded-lg focus:border-primary focus:outline-none transition-colors text-sm"
      />
    </div>

    {/* Teléfono */}
    <div className="relative">
      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="tel"
        value={phoneInput}
        onChange={(e) => {
          setPhoneInput(e.target.value)
          if (searchResult !== "idle") {
            setFoundPatient(null)
            setFoundPatients([])
            setSearchResult("idle")
          }
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSearchPatient()}
        placeholder="Teléfono *"
        className="w-full pl-9 pr-4 py-2.5 border-2 border-muted rounded-lg focus:border-primary focus:outline-none transition-colors text-sm"
      />
    </div>
  </div>

  <div className="flex flex-wrap gap-2 mt-4">
    <Button
      onClick={handleSearchPatient}
      disabled={(!phoneInput.trim() && !nameInput.trim()) || isSearching}
      className="gap-2"
      variant="outline"
    >
      {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      Buscar coincidencia
    </Button>

    {(nameInput || phoneInput || searchResult !== "idle") && (
      <Button
        variant="ghost"
        onClick={handleClearPatient}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
        Limpiar
      </Button>
    )}
  </div>

  <p className="text-xs text-muted-foreground mt-3">
    Puedes continuar aunque el paciente no esté registrado. La búsqueda solo ayuda a vincularlo si ya existe en la base de datos.
  </p>

  {/* Encontrado */}
  {searchResult === "found" && foundPatient && (
    <div className="mt-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 max-w-xl animate-in fade-in slide-in-from-bottom duration-300">
      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
        <UserCheck className="w-5 h-5 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate">{foundPatient.fullName}</p>
        <p className="text-xs text-emerald-700">{foundPatient.phone} · Paciente registrado</p>
      </div>
      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium shrink-0">
        ✓ Vinculado
      </span>
    </div>
  )}

  {/* Múltiples */}
  {searchResult === "multiple" && (
    <div className="mt-4 max-w-xl animate-in fade-in slide-in-from-bottom duration-300">
      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-primary" />
        {foundPatients.length} coincidencias encontradas — selecciona una:
      </p>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {foundPatients.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setFoundPatient(p)
              setNameInput(p.fullName || "")
              setPhoneInput(p.phone || "")
              setFoundPatients([])
              setSearchResult("found")
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 border-muted hover:border-primary/40 hover:bg-muted/40"
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 font-bold text-primary text-sm">
              {p.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{p.fullName}</p>
              <p className="text-xs text-muted-foreground">{p.phone || "Sin teléfono"}</p>
            </div>
            <UserCheck className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )}

  {/* No encontrado */}
  {searchResult === "not_found" && (
    <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-xl animate-in fade-in slide-in-from-bottom duration-300">
      <UserPlus className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800">Paciente no encontrado</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Puedes continuar normalmente. La cita se guardará como paciente sin cuenta registrada.
        </p>
      </div>
    </div>
  )}
</div>

        {/* ── Pasos 2 & 3: Calendario + Horarios ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Calendario */}
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-left duration-500 delay-100">
            <div className="bg-card rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${searchResult !== "idle" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</span>
                Selecciona un día
              </h2>
              <CustomCalendar
                currentMonth={currentMonth}
                selectedDay={selectedDay}
                onSelectDay={async (day) => {
                  // Reconstruir con año/mes/día locales para evitar desfase UTC
                  const normalizedDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0)
                  if (normalizedDay.getDay() === 0) {
                    toast.error("No atendemos los domingos", { description: "Selecciona un día entre lunes y sábado.", duration: 3000, position: "top-center" })
                    return
                  }
                  if (myTempBlockId) await removeTempBlock()
                  setSelectedDay(normalizedDay)
                  setSelectedTime(null)
                  setSelectedCategory(null)
                  setSelectedService(null)
                }}
                onPrevMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
                onNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
              />
            </div>
          </div>

          {/* Horarios */}
          <div className="lg:col-span-2 animate-in fade-in slide-in-from-right duration-500 delay-150">
            <div className="bg-card rounded-2xl shadow-lg p-6 h-full">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${selectedDay ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>3</span>
                Horarios disponibles
              </h2>
              <TimeSlots
                times={getFilteredTimes()}
                selectedTime={selectedTime}
                bookedTimes={bookedSlots}
                tempBlockedTimes={tempBlockedSlots}
                onSelectTime={handleTimeSelect}
                isEnabled={!!selectedDay}
                selectedDate={selectedDay}
              />
              {selectedTime && (
                <div className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${isLateHour(selectedTime) ? "bg-indigo-50 text-indigo-700" : "bg-blue-50 text-blue-700"}`}>
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  {isLateHour(selectedTime)
                    ? "Horario vespertino: servicios especiales y cirugías disponibles."
                    : "Horario matutino: cirugías y USG Especiales no disponibles."}
                </div>
              )}
              {selectedTime && myTempBlockId && (
                <div className="mt-2 p-2 rounded-lg text-xs bg-amber-50 text-amber-700 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Horario reservado 5 min. Confirma pronto.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Paso 4: Servicio ────────────────────────────────────────────── */}
        <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-200">
          <div className="bg-card rounded-2xl shadow-lg p-6 min-h-[380px]">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${selectedDay && selectedTime ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>4</span>
              Selecciona un servicio
            </h2>

            {!selectedDay || !selectedTime ? (
              <div className="flex flex-col items-center justify-center h-56 text-muted-foreground border-2 border-dashed rounded-xl">
                <CalendarCheck className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm">Selecciona día y hora primero</p>
              </div>
            ) : !selectedCategory ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const disabled = !isTimeSuitableForCategory(cat)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => !disabled && setSelectedCategory(cat)}
                      disabled={disabled}
                      className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all duration-200 text-left group ${disabled ? "opacity-50 border-gray-100 bg-gray-50 cursor-not-allowed" : "border-muted hover:border-primary hover:bg-primary/5 cursor-pointer hover:shadow-md"}`}
                    >
                      <div className="flex justify-between w-full mb-3">
                        <span className="text-4xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                        {disabled && <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2 py-1 rounded h-fit">Solo &gt; 4:30 PM</span>}
                      </div>
                      <h3 className="font-bold text-lg mb-1">{cat.name}</h3>
                      <p className="text-sm text-muted-foreground">{cat.description}</p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => { setSelectedCategory(null); setSelectedService(null) }}
                  className="flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Volver a categorías
                </button>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                  <span className="text-3xl">{selectedCategory.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold">{selectedCategory.name}</h3>
                    <p className="text-muted-foreground text-sm">{selectedCategory.description}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  {selectedCategory.subGroups ? (
                    selectedCategory.subGroups.map((group, i) => (
                      <div key={i}>
                        <h4 className="font-semibold text-sm text-primary mb-3 uppercase tracking-wider bg-primary/5 p-2 rounded">
                          {group.title}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.items.map(srv => (
                            <ServiceCard key={srv.id} service={srv} isSelected={selectedService?.id === srv.id} onSelect={() => setSelectedService(srv)} />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedCategory.services?.map(srv => (
                        <ServiceCard key={srv.id} service={srv} isSelected={selectedService?.id === srv.id} onSelect={() => setSelectedService(srv)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Paso 5: Resumen + Doctor ────────────────────────────────────── */}
        {selectedService && defaultDoctor && (
          <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-300">
            <div className="bg-card rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">5</span>
                Resumen
              </h2>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Doctor asignado: <strong>{defaultDoctor.name}</strong> — {defaultDoctor.specialty}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  { label: "Paciente",  value: finalName   || "—" },
                  { label: "Teléfono",  value: finalPhone  || "—" },
                  { label: "Fecha",     value: selectedDay ? format(selectedDay, "d MMM yyyy", { locale: es }) : "—" },
                  { label: "Hora",      value: selectedTime || "—" },
                  { label: "Servicio",  value: selectedService.name },
                  { label: "Precio",    value: `$${typeof selectedService.price === "number" ? selectedService.price.toLocaleString() : selectedService.price}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="font-semibold truncate capitalize">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error banner */}
        {saveError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <span className="flex-1">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Confirm button */}
        <div className="flex justify-center pb-8 animate-in fade-in slide-in-from-bottom duration-500 delay-400">
          <Button
            size="lg"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="w-full sm:w-auto min-w-[320px] h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSaving ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</>
            ) : (
              <><CalendarCheck className="w-5 h-5 mr-2" />
                Confirmar Cita{selectedService
                  ? ` ($${typeof selectedService.price === "number" ? selectedService.price.toLocaleString() : selectedService.price})`
                  : ""}</>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}

// ─── ServiceCard (same as patient scheduler) ──────────────────────────────────
function ServiceCard({ service, isSelected, onSelect }: { service: Service; isSelected: boolean; onSelect: () => void }) {
  const fmt = (p: number | string) => typeof p === "number" ? `$${p.toLocaleString()}` : p
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center ${isSelected ? "border-primary bg-primary/5 shadow-md" : "border-muted/50 hover:border-primary/50 hover:bg-muted/30"}`}
    >
      <div>
        <div className="font-medium">{service.name}</div>
        {service.duration && <div className="text-xs text-muted-foreground mt-1">⏱ {service.duration} min</div>}
        {service.note && <div className="text-xs text-amber-600 mt-1 font-medium">{service.note}</div>}
      </div>
      <div className="font-bold text-primary ml-4 shrink-0">{fmt(service.price)}</div>
    </div>
  )
}