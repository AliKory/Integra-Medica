"use client"

import { useState, useEffect } from "react"
import { 
  Clock, Save, Loader2, Plus, Trash2, AlertCircle, Laptop, Sun, Moon, Monitor
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore"
import { toast } from "sonner"
import { useTheme } from "next-themes"

function formatTo12Hour(time24: string) {
  const [hours, minutes] = time24.split(":")
  let h = parseInt(hours)
  const ampm = h >= 12 ? "PM" : "AM"

  h = h % 12
  if (h === 0) h = 12

  const formattedHour = h.toString().padStart(2, "0")

  return `${formattedHour}:${minutes} ${ampm}`
}

export function SystemSettings() {
  const [slots, setSlots] = useState<string[]>([])
  const [newSlot, setNewSlot] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { theme, setTheme } = useTheme()

  // Referencia exacta a config > availableTimes
  const configDocRef = doc(db, "config", "availableTimes")

  // 1. Cargar Slots desde la BD
  useEffect(() => {
    async function loadSlots() {
      try {
        const snap = await getDoc(configDocRef)
        if (snap.exists()) {
          // Extraemos el array del campo 'slots'
          const data = snap.data().slots || []
          // Ordenamos los horarios para que se vean bien (08:00, 09:00...)
          setSlots(data.sort())
        }
      } catch (error) {
        console.error(error)
        toast.error("Error al conectar con la base de datos")
      } finally {
        setLoading(false)
      }
    }
    loadSlots()
  }, [])

  // 2. Agregar un nuevo horario al array 'slots'
  const addSlot = async () => {
    if (!newSlot) return
    const formatted = formatTo12Hour(newSlot)

if (slots.includes(formatted)) {
  return toast.error("Este horario ya existe")
}
    
    setSaving(true)
    try {
      const formatted = formatTo12Hour(newSlot)

      await updateDoc(configDocRef, {
  slots: arrayUnion(formatted)
      })
      setSlots(prev => [...prev, formatted].sort())
      setNewSlot("")
      toast.success("Horario habilitado")
    } catch (e) {
      toast.error("Error al guardar en la ruta config/availableTimes")
    } finally {
      setSaving(false)
    }
  }

  // 3. Eliminar un horario del array 'slots'
  const removeSlot = async (slot: string) => {
    try {
      await updateDoc(configDocRef, {
        slots: arrayRemove(slot)
      })
      setSlots(prev => prev.filter(s => s !== slot))
      toast.info("Horario removido")
    } catch (e) {
      toast.error("Error al eliminar")
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Configuración del Sistema</h2>
        <p className="text-sm text-muted-foreground">Administra los horarios de cita y preferencias visuales.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GESTIÓN DE HORARIOS */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Disponibilidad de Citas
            </CardTitle>
            <CardDescription>
              Añade los horarios que estarán disponibles para los pacientes en la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex items-end gap-3 bg-muted/20 p-4 rounded-xl border border-dashed">
              <div className="flex-1 space-y-2">
                <Label className="text-xs">Seleccionar hora</Label>
                <Input 
                  type="time" 
                  value={newSlot} 
                  className="bg-background"
                  onChange={(e) => setNewSlot(e.target.value)}
                />
              </div>
              <Button onClick={addSlot} disabled={saving || !newSlot} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Habilitar Hora
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {slots.length > 0 ? (
                slots.map((slot) => (
                  <div 
                    key={slot} 
                    className="flex items-center justify-between px-3 py-2 rounded-lg border bg-background hover:border-primary/50 transition-all group"
                  >
                    <span className="text-sm font-semibold">{slot}</span>
                    <button 
                      onClick={() => removeSlot(slot)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Eliminar horario"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-10 border rounded-xl bg-muted/10">
                   <p className="text-xs text-muted-foreground italic">No hay horarios definidos en la base de datos.</p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-[11px]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Los horarios aquí listados se guardan en <strong>config/availableTimes</strong>. 
                Si un horario ya pasó en el día actual o está ocupado, la lógica del cliente lo ocultará automáticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* APARIENCIA */}
        <div className="space-y-6">
          <Card className="border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Laptop className="h-4 w-4" /> Tema del Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'light', icon: Sun, label: 'Claro' },
                  { id: 'dark', icon: Moon, label: 'Oscuro' },
                  { id: 'system', icon: Monitor, label: 'Sistema' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all",
                      theme === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-muted/30 opacity-70"
                    )}
                  >
                    <t.icon className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase">{t.label}</span>
                  </button>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Sincronización Cloud</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                   ACTIVA
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}