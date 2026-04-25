"use client"

import { useState, useEffect, useMemo } from "react"
import {
  CalendarDays, UserPlus, DollarSign, Activity, FlaskConical, UserX,
  ArrowUpRight, ArrowDownRight, Download, FileSpreadsheet, FileText,
  CalendarRange, Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Area, AreaChart,
} from "recharts"
import { db } from "@/lib/firebase"
import { collection, getDocs, Timestamp, collectionGroup } from "firebase/firestore"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Appointment {
  id: string
  date: any
  time?: string
  status: string
  price?: number
  serviceName?: string
  categoryName?: string
  type?: string
}

interface UserData {
  id: string
  createdAt: Date | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const PIE_COLORS = ["#DC2626", "#2563EB", "#059669", "#D97706", "#7C3AED", "#0891B2"]

function toDate(val: any): Date | null {
  if (!val) return null
  if (val instanceof Timestamp) return val.toDate()
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

function lastNMonths(n: number) {
  const now = new Date()
  const result = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() })
  }
  return result
}

function getHeatColor(val: number): string {
  if (val === 0) return "bg-muted/30"
  if (val <= 2) return "bg-primary/20"
  if (val <= 5) return "bg-primary/50"
  return "bg-primary/90"
}

// ─── Componente Principal ──────────────────────────────────────────────────────
export function CrmDashboard() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState("month")
  const [chartPeriod, setChartPeriod] = useState<"day" | "month">("day")
  
  // Estados de datos
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [usersData, setUsersData] = useState<UserData[]>([])
  const [labsCount, setLabsCount] = useState(0)

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true)
        const [apptSnap, usersSnap, labSnap] = await Promise.all([
          getDocs(collection(db, "appointments")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "gynLabRecords"))
        ])

        setAppointments(apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
        setUsersData(usersSnap.docs.map(d => ({ id: d.id, createdAt: toDate(d.data().createdAt) })))
        setLabsCount(labSnap.docs.filter(d => d.data().status === "pending").length)
      } catch (err) {
        console.error("Error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  // ── 1. Citas Hoy ────────────────────────────────────────────────────────────
  const citasHoy = useMemo(() => 
    appointments.filter(a => toDate(a.date)?.toDateString() === now.toDateString()).length
  , [appointments])

  // ── 2. Nuevos Pacientes (Basado en users.createdAt) ─────────────────────────
  const newPatientsThisMonth = useMemo(() => 
    usersData.filter(u => u.createdAt && u.createdAt >= thisMonthStart).length
  , [usersData, thisMonthStart])

  // ── 3. Ingresos (Solo completed) ────────────────────────────────────────────
  const revenueThisMonth = useMemo(() => 
    appointments.filter(a => toDate(a.date) && toDate(a.date)! >= thisMonthStart && a.status === "completed")
      .reduce((sum, a) => sum + (Number(a.price) || 0), 0)
  , [appointments, thisMonthStart])

  // ── 4. Ocupación y No-Show ──────────────────────────────────────────────────
  const ocupacion = useMemo(() => {
    const monthAppts = appointments.filter(a => toDate(a.date) && toDate(a.date)! >= thisMonthStart)
    if (monthAppts.length === 0) return 0
    return Math.round((monthAppts.filter(a => a.status === "completed").length / monthAppts.length) * 100)
  }, [appointments, thisMonthStart])

  const noShowRate = useMemo(() => {
    const monthAppts = appointments.filter(a => toDate(a.date) && toDate(a.date)! >= thisMonthStart)
    if (monthAppts.length === 0) return "0.0"
    return ((monthAppts.filter(a => a.status === "no_show").length / monthAppts.length) * 100).toFixed(1)
  }, [appointments, thisMonthStart])

  // ── Gráfica: Citas Programadas ──────────────────────────────────────────────
  const appointmentsByDay = useMemo(() => {
    const counts = [0,0,0,0,0,0,0]
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
    appointments.forEach(a => {
      const d = toDate(a.date)
      if(d && d >= weekStart) counts[d.getDay()]++
    })
    return [1,2,3,4,5,6,0].map(i => ({ day: DAY_LABELS[i], citas: counts[i] }))
  }, [appointments])

  const appointmentsByMonth = useMemo(() => {
    return lastNMonths(7).map(({ label, year, month }) => ({
      month: label,
      citas: appointments.filter(a => {
        const d = toDate(a.date); return d && d.getFullYear() === year && d.getMonth() === month
      }).length
    }))
  }, [appointments])

  // ── Gráfica: Nuevos vs Recurrentes ──────────────────────────────────────────
  const patientsData = useMemo(() => {
    return lastNMonths(7).map(({ label, year, month }) => {
      const usersInMonth = usersData.filter(u => u.createdAt?.getFullYear() === year && u.createdAt?.getMonth() === month).length
      const totalAppts = appointments.filter(a => {
        const d = toDate(a.date); return d && d.getFullYear() === year && d.getMonth() === month
      }).length
      return { month: label, nuevos: usersInMonth, recurrentes: Math.max(0, totalAppts - usersInMonth) }
    })
  }, [appointments, usersData])

  // ── Gráfica: Ingresos y Proyección ─────────────────────────────────────────
  const revenueData = useMemo(() => {
    return lastNMonths(7).map(({ label, year, month }) => {
      const ing = appointments
        .filter(a => {
          const d = toDate(a.date); 
          return d && d.getFullYear() === year && d.getMonth() === month && a.status === "completed"
        })
        .reduce((s, a) => s + (Number(a.price) || 0), 0)
      return { month: label, ingresos: ing, proyeccion: Math.round(ing * 1.1) }
    })
  }, [appointments])

  // ── Gráfica: Servicios (Sin Imagenología) ───────────────────────────────────
  const serviceDistribution = useMemo(() => {
    const cats = [...new Set(appointments.map(a => a.categoryName || "General"))]
      .filter(c => c !== "Imagenología").slice(0, 6)
    return cats.map(cat => ({
      service: cat,
      consultas: appointments.filter(a => a.categoryName === cat && a.type !== "lab").length,
      laboratorio: appointments.filter(a => a.categoryName === cat && a.type === "lab").length,
    }))
  }, [appointments])

  // ── Heatmap ─────────────────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]
    const dayKeys = ["lun", "mar", "mie", "jue", "vie", "sab"]
    return hours.map(h => {
      const row: any = { hour: h }
      dayKeys.forEach(dk => row[dk] = 0)
      appointments.forEach(a => {
        const d = toDate(a.date)
        if (d && a.time && a.time.startsWith(h.substring(0,2))) {
          const dk = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"][d.getDay()]
          if (row[dk] !== undefined) row[dk]++
        }
      })
      return row
    })
  }, [appointments])

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="animate-spin h-8 w-8" /></div>

  return (
    <div className="space-y-6 p-4">
      {/* Controles */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Panel CRM</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
          <Button size="sm"><Download className="mr-2 h-4 w-4" /> Reporte</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={CalendarDays} label="Citas Hoy" value={citasHoy} color="text-primary" bg="bg-primary/10" />
        <KpiCard icon={UserPlus} label="Nuevos Pacientes" value={newPatientsThisMonth} color="text-blue-600" bg="bg-blue-50" />
        <KpiCard icon={DollarSign} label="Ingresos Mes" value={`$${revenueThisMonth.toLocaleString()}`} color="text-emerald-600" bg="bg-emerald-50" />
        <KpiCard icon={Activity} label="Ocupación" value={`${ocupacion}%`} color="text-amber-600" bg="bg-amber-50" />
        <KpiCard icon={FlaskConical} label="Labs Pendientes" value={labsCount} color="text-indigo-600" bg="bg-indigo-50" />
        <KpiCard icon={UserX} label="Tasa No-Show" value={`${noShowRate}%`} color="text-rose-600" bg="bg-rose-50" />
      </div>

      {/* Fila 1: Citas e Ingresos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Citas Programadas</CardTitle>
            <Select value={chartPeriod} onValueChange={(v:any) => setChartPeriod(v)}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Día</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPeriod === "day" ? appointmentsByDay : appointmentsByMonth}>
                <XAxis dataKey={chartPeriod === "day" ? "day" : "month"} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="citas" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ingresos y Proyecciones</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="ingresos" stroke="#059669" fill="#05966920" />
                <Area type="monotone" dataKey="proyeccion" stroke="#D97706" fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: Pacientes y Servicios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Nuevos vs Recurrentes</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={patientsData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="nuevos" stroke="#2563EB" strokeWidth={2} />
                <Line type="monotone" dataKey="recurrentes" stroke="#059669" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Servicios más Solicitados</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceDistribution}>
                <XAxis dataKey="service" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="consultas" stackId="a" fill="#DC2626" />
                <Bar dataKey="laboratorio" stackId="a" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Fila 3: Heatmap */}
      <Card>
        <CardHeader><CardTitle className="text-base">Horarios más Demandados</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 min-w-[500px]">
            <div /> {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => <div key={d} className="text-center text-xs font-bold">{d}</div>)}
            {heatmapData.map(row => (
              <div key={row.hour} className="contents">
                <div className="text-xs text-muted-foreground flex items-center">{row.hour}</div>
                {["lun", "mar", "mie", "jue", "vie", "sab"].map(d => (
                  <div key={d} className={cn("h-10 rounded flex items-center justify-center text-[10px]", getHeatColor(row[d]))}>
                    {row[d] > 0 ? row[d] : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", bg)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </CardContent>
    </Card>
  )
}