"use client"

import { useState, useEffect, useRef } from "react"
import { format, addMonths, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { CustomCalendar } from "./custom-calendar"
import { TimeSlots } from "./time-slots"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CalendarCheck, CheckCircle2, ChevronLeft, Info, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { db, auth} from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp
} from "firebase/firestore"
import { toast } from "sonner"

// TypeScript Interfaces
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

// 🔥 NUEVA INTERFAZ PARA BLOQUEOS TEMPORALES
interface TempBlock {
  id: string
  date: string
  time: string
  userId: string
  expiresAt: Timestamp
}

// Generar ID único por sesión — protegido contra SSR (Next.js)
const getUserSessionId = () => {
  if (typeof window === "undefined") return `ssr_${Math.random().toString(36).substr(2, 9)}`
  let sessionId = sessionStorage.getItem("userSessionId")
  if (!sessionId) {
    sessionId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem("userSessionId", sessionId)
  }
  return sessionId
}

export default function SchedulerPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set())
  
  // 🔥 NUEVOS ESTADOS PARA BLOQUEOS TEMPORALES
  const [tempBlockedSlots, setTempBlockedSlots] = useState<Set<string>>(new Set())
  const [myTempBlockId, setMyTempBlockId] = useState<string | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)

  const [patientName, setPatientName] = useState("")
  const [patientPhone, setPatientPhone] = useState("")

  const userSessionId = useRef(getUserSessionId())
  const tempBlockTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Ref mirrors myTempBlockId state so removeTempBlock() never reads a stale
  // closure value (critical for the useEffect cleanup and setTimeout callbacks).
  const myTempBlockIdRef = useRef<string | null>(null)

  const [currentUser, setCurrentUser] = useState<any>(null)

  // Doctor con avatar
interface DefaultDoctor {
  id: string;
  name: string;
  specialty: string;
  avatar: string;
}

const [defaultDoctor, setDefaultDoctor] = useState<DefaultDoctor | null>(null);

  // 🔥 NUEVO: Detectar usuario logueado y pre-llenar datos
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user)
        try {
          // Buscamos el nombre real en la colección 'users'
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            // Autocompletamos el nombre en el formulario
            setPatientName(userData.fullName || "") 
            // Si tuvieras teléfono guardado, también podrías poner:
            setPatientPhone(userData.phone || "")
          }
        } catch (error) {
          console.error("Error obteniendo datos del usuario", error)
        }
      } else {
        setCurrentUser(null)
        setPatientName("") // Limpiar si no hay usuario
        setPatientPhone("") // Limpiar si cierra sesión
      }
    })
    return () => unsubscribe()
  }, [])

  // CARGAR DOCTOR POR DEFECTO DESDE FIRESTORE
useEffect(() => {
  const loadDefaultDoctor = async () => {
    try {
      // Intento 1: Doctor con isDefault: true (como pediste anteriormente)
      const q = query(
        collection(db, "doctors"),
        where("isDefault", "==", true)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();

        setDefaultDoctor({
          id: docSnap.id,
          name: data.name || "Dr. Principal",
          specialty: data.specialty || "Medicina General",
          avatar: data.doctorAvatar || "/placeholder-doctor.jpg",
        });
        return;
      }

      // Intento 2: Primer doctor disponible
      const allDoctors = await getDocs(collection(db, "doctors"));
      if (!allDoctors.empty) {
        const firstDoc = allDoctors.docs[0];
        const data = firstDoc.data();

        setDefaultDoctor({
          id: firstDoc.id,
          name: data.name || "Dr. Principal",
          specialty: data.specialty || "Medicina General",
          avatar: data.doctorAvatar || "/placeholder-doctor.jpg",
        });
        return;
      }

      // Fallback final
      setDefaultDoctor({
        id: "sin_asignar",
        name: "Por asignar",
        specialty: "Medicina General",
        avatar: "/placeholder-doctor.jpg" ,
      });
    } catch (error) {
      console.error("Error cargando doctor por defecto:", error);
      setDefaultDoctor({
        id: "sin_asignar",
        name: "Por asignar",
        specialty: "Medicina General",
        avatar:  "/placeholder-doctor.jpg",
      });
    }
  };

  loadDefaultDoctor();
}, []);

  // 🔥 CARGAR CATEGORÍAS Y SERVICIOS DESDE FIRESTORE
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true)
        const categoriesSnapshot = await getDocs(collection(db, "serviceCategories"))
        
        const categoriesData = await Promise.all(
          categoriesSnapshot.docs.map(async (categoryDoc) => {
            const catData = categoryDoc.data()
            
            const servicesSnap = await getDocs(
              collection(db, "serviceCategories", categoryDoc.id, "services")
            )
            
            const servicesList = servicesSnap.docs.map(s => ({
              id: s.id,
              ...s.data()
            })) as Service[]

            const servicesWithGroup = servicesList.filter(s => s.group)
            
            if (servicesWithGroup.length > 0) {
              const groups: Record<string, SubGroup> = {}
              servicesList.forEach(s => {
                const gName = s.group || "General"
                if (!groups[gName]) groups[gName] = { title: gName, items: [] }
                groups[gName].items.push(s)
              })
              return { id: categoryDoc.id, ...catData, subGroups: Object.values(groups) } as Category
            } else {
              return { id: categoryDoc.id, ...catData, services: servicesList } as Category
            }
          })
        )

        setCategories(categoriesData)
      } catch (error) {
        console.error("Error en categorías:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCategories()
  }, [])

  // 🔥 CARGAR HORARIOS DISPONIBLES DESDE FIRESTORE
  useEffect(() => {
    const fetchAvailableTimes = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "availableTimes"))
        if (configDoc.exists()) {
          setAvailableTimes(configDoc.data().slots || [])
        }
      } catch (error) {
        console.error("Error cargando horarios:", error)
      }
    }
    fetchAvailableTimes()
  }, [])

  // 🔥 CARGAR CITAS OCUPADAS + LISTENER EN TIEMPO REAL
  useEffect(() => {
    if (!selectedDay) {
      setBookedSlots(new Set())
      return
    }

    const dateStr = format(selectedDay, "yyyy-MM-dd")
    
    // Query para citas confirmadas
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("date", "==", dateStr),
      where("status", "!=", "cancelled")
    )
    
    // Listener en tiempo real
    const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
      const booked = new Set(snapshot.docs.map(doc => doc.data().time))
      setBookedSlots(booked)
    })

    return () => unsubscribe()
  }, [selectedDay])

  // 🔥 LISTENER PARA BLOQUEOS TEMPORALES EN TIEMPO REAL (CORREGIDO)
  useEffect(() => {
    if (!selectedDay) {
      setTempBlockedSlots(new Set())
      return
    }

    const dateStr = format(selectedDay, "yyyy-MM-dd")
    
    const tempBlocksQuery = query(
      collection(db, "tempTimeBlocks"),
      where("date", "==", dateStr),
      where("expiresAt", ">", Timestamp.now())
    )
    
    const unsubscribe = onSnapshot(tempBlocksQuery, (snapshot) => {
      const blocked = new Set<string>()
      
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        // Solo bloquear si es de otro usuario Y la misma fecha
        if (data.userId !== userSessionId.current && data.date === dateStr) {
          blocked.add(data.time)
        }
      })
      
      setTempBlockedSlots(blocked)
    })

    return () => unsubscribe()
  }, [selectedDay])

  // 🔥 NUEVO: CREAR BLOQUEO TEMPORAL AL SELECCIONAR HORA (MEJORADO)
  const createTempBlock = async (time: string) => {
    if (!selectedDay) return

    try {
      const dateStr = format(selectedDay, "yyyy-MM-dd")
      
      // 🔥 VERIFICAR SI YA EXISTE UN BLOQUEO ACTIVO PARA ESTA FECHA+HORA
      const existingBlockQuery = query(
        collection(db, "tempTimeBlocks"),
        where("date", "==", dateStr),
        where("time", "==", time),
        where("expiresAt", ">", Timestamp.now())
      )
      
      const existingBlocks = await getDocs(existingBlockQuery)
      
      // Si ya hay un bloqueo activo de otro usuario, no crear uno nuevo
      if (!existingBlocks.empty) {
        const otherUserBlock = existingBlocks.docs.find(
          doc => doc.data().userId !== userSessionId.current
        )
        if (otherUserBlock) {
          console.log("⚠️ Horario ya está siendo reservado por otro usuario")
          setSelectedTime(null)
          alert("Este horario acaba de ser seleccionado por otro usuario. Por favor elige otro.")
          return
        }
      }
      
      // Tiempo de expiración: 5 minutos
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000))
      
      const tempBlockData = {
        date: dateStr,
        time: time,
        userId: userSessionId.current,
        expiresAt: expiresAt,
        createdAt: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, "tempTimeBlocks"), tempBlockData)
      setMyTempBlockId(docRef.id)
      myTempBlockIdRef.current = docRef.id
      
      console.log(`✅ Bloqueo temporal creado: ${dateStr} ${time}`)

      // Auto-eliminar después de 5 minutos
      if (tempBlockTimeoutRef.current) {
        clearTimeout(tempBlockTimeoutRef.current)
      }
      
      tempBlockTimeoutRef.current = setTimeout(async () => {
        console.log("⏰ Bloqueo temporal expirado, liberando...")
        await removeTempBlock()
      }, 5 * 60 * 1000)

    } catch (error) {
      console.error("Error creando bloqueo temporal:", error)
    }
  }

  // 🔥 ELIMINAR BLOQUEO TEMPORAL — usa ref para evitar stale closure
  const removeTempBlock = async () => {
    const idToRemove = myTempBlockIdRef.current
    if (!idToRemove) return

    try {
      await deleteDoc(doc(db, "tempTimeBlocks", idToRemove))
      setMyTempBlockId(null)
      myTempBlockIdRef.current = null

      if (tempBlockTimeoutRef.current) {
        clearTimeout(tempBlockTimeoutRef.current)
        tempBlockTimeoutRef.current = null
      }
    } catch (error) {
      console.error("Error eliminando bloqueo temporal:", error)
    }
  }

  // 🔥 LIMPIAR BLOQUEO AL DESMONTAR COMPONENTE
  // No deps needed — removeTempBlock reads from ref, never stale.
  useEffect(() => {
    return () => {
      if (myTempBlockIdRef.current) {
        removeTempBlock()
      }
      if (tempBlockTimeoutRef.current) {
        clearTimeout(tempBlockTimeoutRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  // 🔥 MODIFICADO: Manejar selección de hora con bloqueo temporal
  const handleTimeSelect = async (time: string) => {
    if (myTempBlockId) {
      await removeTempBlock()
    }

    setSelectedTime(time)
    setSelectedCategory(null)
    setSelectedService(null)
    setSaveError(null)

    await createTempBlock(time)
  }

    // ── Guardar cita en Firestore ──────────────────────────────────────────────
  const handleConfirm = async () => {
    // All required values are guaranteed by the button's disabled condition,
    // but we guard here too for safety.
    if (!selectedDay || !selectedTime || !selectedService || !selectedCategory || !defaultDoctor) return
    if (!patientName.trim() || !patientPhone.trim()) return

    try {
      setIsSaving(true)
      setSaveError(null)

      const dateStr = format(selectedDay, "yyyy-MM-dd")

      const appointmentData = {
        patientId:    currentUser?.uid || `guest_${Date.now()}`,
        patientName:  patientName.trim(),
        patientPhone: patientPhone.trim(),

        doctorId:   defaultDoctor.id,
        doctorName: defaultDoctor.name,
        doctorAvatar: defaultDoctor.avatar,
        specialty:  defaultDoctor.specialty,

        serviceId:   selectedService.id,
        serviceName: selectedService.name,

        date:     dateStr,
        time:     selectedTime,
        location: "Consultorio 1",

        status: "pending",
        type:   "scheduled" as const,

        price: typeof selectedService.price === "number"
          ? selectedService.price
          : parseInt(selectedService.price as string) || 0,

        categoryId:          selectedCategory.id,
        categoryName:        selectedCategory.name,
        serviceDuration:     selectedService.duration || null,
        serviceNote:         selectedService.note || null,
        requiresLateHour:    selectedCategory.requiresLateHour || false,
        userId:              currentUser?.uid || null,

        createdAt: serverTimestamp(),
      }

      await addDoc(collection(db, "appointments"), appointmentData)
      await removeTempBlock()

      setIsConfirmed(true)
    } catch (error) {
      console.error("Error guardando cita:", error)
      setSaveError("Hubo un error al agendar la cita. Por favor intenta de nuevo.")
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

  if (currentUser) {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        setPatientName(userData.fullName || "")
        // Volvemos a poner el teléfono del perfil
        setPatientPhone(userData.phone || "")
      }
    } catch {
      setPatientName("")
      setPatientPhone("")
    }
  } else {
    setPatientName("")
    setPatientPhone("")
  }
}

  const isLateHour = (timeStr: string | null) => {
    if (!timeStr) return false;
    
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;

    const totalMinutes = hours * 60 + minutes;
    const cutoffMinutes = 16 * 60 + 30;

    return totalMinutes >= cutoffMinutes;
  };

  // Filtra horas ya pasadas si el día seleccionado es hoy
const getFilteredTimes = () => {
  if (!selectedDay) return availableTimes

  const today = new Date()
  const isToday =
    selectedDay.getFullYear() === today.getFullYear() &&
    selectedDay.getMonth() === today.getMonth() &&
    selectedDay.getDate() === today.getDate()

  if (!isToday) return availableTimes

  const nowMinutes = today.getHours() * 60 + today.getMinutes()

  return availableTimes.filter((timeStr) => {
    const [time, modifier] = timeStr.split(" ")
    let [hours, minutes] = time.split(":").map(Number)
    if (modifier === "PM" && hours !== 12) hours += 12
    if (modifier === "AM" && hours === 12) hours = 0
    return hours * 60 + minutes > nowMinutes
  })
}

  const isTimeSuitableForCategory = (category: Category) => {
    if (!category.requiresLateHour) return true
    return isLateHour(selectedTime)
  }

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

  if (isConfirmed && selectedDay && selectedTime && selectedService && selectedCategory) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-card rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Cita Confirmada</h1>
            <p className="text-muted-foreground mb-8">Tu cita ha sido agendada exitosamente</p>

            <div className="bg-muted/50 rounded-xl p-6 mb-8 text-left space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Paciente</span>
                <span className="font-semibold">{patientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Teléfono</span>
                <span className="font-semibold">{patientPhone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Servicio</span>
                <span className="font-semibold text-right">{selectedService.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Categoría</span>
                <span className="font-semibold text-sm bg-primary/10 px-2 py-1 rounded text-primary">{selectedCategory.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Fecha</span>
                <span className="font-semibold capitalize">
                  {format(selectedDay, "EEEE, d MMMM yyyy", { locale: es })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Hora</span>
                <span className="font-semibold">{selectedTime}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-muted-foreground">Precio estimado</span>
                <span className="font-bold text-xl text-primary">
                  ${typeof selectedService.price === 'number' ? selectedService.price : selectedService.price}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={handleReset}>
                Agendar otra cita
              </Button>
              <Button asChild className="flex-1 bg-primary hover:bg-primary/90">
                <Link href="/">Volver al inicio</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Agenda tu cita</h1>
              <p className="text-sm text-muted-foreground">Selecciona fecha, hora y servicio</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-left duration-500">
            <div className="bg-card rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Selecciona un día
              </h2>
              <CustomCalendar
                currentMonth={currentMonth}
                selectedDay={selectedDay}
                onSelectDay={async (day) => {
if (day.getDay() === 0) {
    toast.error("No atendemos los domingos", {
      description: "Por favor selecciona un día entre lunes y sábado.",
      duration: 4000,
      position: "top-center",
    });
    return;
  }
                  // Limpiar bloqueo temporal al cambiar de día
                  if (myTempBlockId) {
                    await removeTempBlock()
                  }
                  setSelectedDay(day)
                  setSelectedTime(null)
                  setSelectedCategory(null)
                  setSelectedService(null)
                }}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
              />
            </div>
          </div>

          <div className="lg:col-span-2 animate-in fade-in slide-in-from-right duration-500 delay-150">
            <div className="bg-card rounded-2xl shadow-lg p-6 h-full">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${selectedDay ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</span>
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
                     ? "Horario vespertino seleccionado: Servicios especiales y cirugías disponibles." 
                     : "Horario matutino/temprano: Cirugías y USG Especiales no disponibles."}
                </div>
              )}
              
              {/* 🔥 NUEVO: Mostrar tiempo restante del bloqueo */}
              {selectedTime && myTempBlockId && (
                <div className="mt-2 p-2 rounded-lg text-xs bg-amber-50 text-amber-700 flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  Horario reservado por 5 minutos. Confirma pronto.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-300">
          <div className="bg-card rounded-2xl shadow-lg p-6 mb-8 min-h-[400px]">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${selectedDay && selectedTime ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>3</span>
              Selecciona un servicio
            </h2>

            {!selectedDay || !selectedTime ? (
               <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-xl">
                 <CalendarCheck className="w-12 h-12 mb-2 opacity-20" />
                 <p>Por favor selecciona día y hora primero</p>
               </div>
            ) : !selectedCategory ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                    const isDisabled = !isTimeSuitableForCategory(cat)
                    return (
                        <button
                            key={cat.id}
                            onClick={() => !isDisabled && setSelectedCategory(cat)}
                            disabled={isDisabled}
                            className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all duration-200 text-left group
                                ${isDisabled 
                                    ? "opacity-50 border-gray-100 bg-gray-50 cursor-not-allowed" 
                                    : "border-muted hover:border-primary hover:bg-primary/5 cursor-pointer hover:shadow-md"
                                }
                            `}
                        >
                            <div className="flex justify-between w-full mb-3">
                                <span className="text-4xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                                {isDisabled && <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2 py-1 rounded h-fit">Solo &gt; 4:30 PM</span>}
                            </div>
                            <h3 className="font-bold text-lg text-foreground mb-1">{cat.name}</h3>
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
                        selectedCategory.subGroups.map((group: SubGroup, idx: number) => (
                            <div key={idx} className="mb-6">
                                <h4 className="font-semibold text-sm text-primary mb-3 uppercase tracking-wider flex items-center gap-2 bg-primary/5 p-2 rounded">
                                    {group.title}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {group.items.map((srv: Service) => (
                                        <ServiceCard 
                                            key={srv.id} 
                                            service={srv} 
                                            isSelected={selectedService?.id === srv.id} 
                                            onSelect={() => setSelectedService(srv)} 
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {selectedCategory.services?.map((srv: Service) => (
                                <ServiceCard 
                                    key={srv.id} 
                                    service={srv} 
                                    isSelected={selectedService?.id === srv.id} 
                                    onSelect={() => setSelectedService(srv)} 
                                />
                            ))}
                        </div>
                    )}
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Paso 4: Tus datos + Doctor asignado */}
{selectedService && defaultDoctor && (
  <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-400">
    <div className="bg-card rounded-2xl shadow-lg p-6 mb-8">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">4</span>
        Tus datos
      </h2>

      {/* Doctor Info desde BD */}
{selectedService && defaultDoctor && (
  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-4">
    {/* Contenedor de la foto */}
    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
      <img 
        src={defaultDoctor.avatar} // Esto ahora tendrá la URL de Cloudinary
        alt={defaultDoctor.name}
        className="w-full h-full object-cover"
        // Si la imagen falla, podemos poner un error manual
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/placeholder-doctor.jpg"
        }}
      />
    </div>
    
    <div>
      <p className="text-sm text-emerald-700 font-medium">
        Serás atendido por: <strong>{defaultDoctor.name}</strong>
      </p>
      <p className="text-xs text-emerald-600">{defaultDoctor.specialty}</p>
    </div>
  </div>
)}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Nombre completo *
          </label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Ej: María García López"
            className="w-full px-4 py-2 border-2 border-muted rounded-lg focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <div>
  <label className="block text-sm font-medium text-foreground mb-2 flex justify-between">
    <span>Teléfono *</span>
    {currentUser && patientPhone && (
      <span className="text-[10px] text-primary flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Sugerido de tu perfil
      </span>
    )}
  </label>
  <input
    type="tel"
    value={patientPhone}
    onChange={(e) => setPatientPhone(e.target.value)}
    placeholder="Ej: 442 123 4567"
    className="w-full px-4 py-2 border-2 border-muted rounded-lg focus:border-primary focus:outline-none transition-colors"
  />
</div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        * Campos requeridos.
      </p>
    </div>
  </div>
)}

        {/* Mensaje de Error Mejorado */}
{saveError && (
  <div className="max-w-2xl mx-auto mb-6">
    <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700 shadow-sm">
      <div className="flex-shrink-0">
        <AlertCircle className="h-6 w-6 text-red-600" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{saveError}</p>
        <p className="text-sm text-red-600/80 mt-1">
          Solo atendemos de lunes a sábado.
        </p>
      </div>
      <button
        onClick={() => setSaveError(null)}
        className="text-red-400 hover:text-red-600 text-xl leading-none"
      >
        ×
      </button>
    </div>
  </div>
)}

        <div className="flex justify-center animate-in fade-in slide-in-from-bottom duration-500 delay-500">
          <Button
            size="lg"
            disabled={
              !selectedDay ||
              !selectedTime ||
              !selectedService ||
              !defaultDoctor ||
              !patientName.trim() ||
              !patientPhone.trim() ||
              isSaving
            }
            onClick={handleConfirm}
            className="w-full sm:w-auto min-w-[300px] h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CalendarCheck className="w-5 h-5 mr-2" />
                Confirmar Cita{selectedService
                  ? ` ($${typeof selectedService.price === "number"
                      ? selectedService.price.toLocaleString()
                      : selectedService.price})`
                  : ""}
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}

function ServiceCard({ service, isSelected, onSelect }: { 
  service: Service
  isSelected: boolean
  onSelect: () => void 
}) {
    const formatPrice = (price: number | string) => {
      if (typeof price === 'number') {
        return `$${price.toLocaleString()}`
      }
      return price
    }

    return (
        <div 
            onClick={onSelect}
            className={`
                p-4 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center
                ${isSelected 
                    ? "border-primary bg-primary/5 shadow-md" 
                    : "border-muted/50 hover:border-primary/50 hover:bg-muted/30"
                }
            `}
        >
            <div>
                <div className="font-medium">{service.name}</div>
                {service.duration && <div className="text-xs text-muted-foreground mt-1">⏱ {service.duration} min</div>}
            </div>
            <div className="font-bold text-primary ml-4">{formatPrice(service.price)}</div>
        </div>
    )
}