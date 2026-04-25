"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import {
  FlaskConical,
  Search,
  Plus,
  Phone,
  User,
  ChevronRight,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  Bell,
  X,
  Check,
  FileText,
  Filter,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  where,
} from "firebase/firestore"
import type { LabExamType } from "../admin/lab-management-admin"

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type GynLabStatus = "tomado" | "enviado" | "listo"

export interface GynLabRecord {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  examTypeId: string
  examTypeName: string
  examTypeCode: string
  cost: number
  status: GynLabStatus
  notes: string
  date: string
  notifiedAt?: string
  createdAt?: any
}

interface Patient {
  id: string
  fullName: string
  phone: string
}

// ─── Config de estados ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<GynLabStatus, {
  label: string
  icon: React.ReactNode
  badgeClass: string
  next: GynLabStatus | null
  nextLabel: string | null
  nextIcon: React.ReactNode | null
}> = {
  tomado: {
    label: "Muestra tomada",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    next: "enviado",
    nextLabel: "Marcar como enviado",
    nextIcon: <Send className="h-3.5 w-3.5" />,
  },
  enviado: {
    label: "Enviado al lab",
    icon: <Send className="h-3.5 w-3.5" />,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    next: "listo",
    nextLabel: "Marcar como listo",
    nextIcon: <Bell className="h-3.5 w-3.5" />,
  },
  listo: {
    label: "Listo para recoger",
    icon: <Bell className="h-3.5 w-3.5" />,
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    next: null,
    nextLabel: null,
    nextIcon: null,
  },
}

// ─── Componente: búsqueda de paciente por teléfono ───────────────────────────
interface PatientSearchProps {
  patients: Patient[]
  onSelect: (p: Patient | null) => void
  selected: Patient | null
}

function PatientSearch({ patients, onSelect, selected }: PatientSearchProps) {
  const [phoneInput, setPhoneInput] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [foundInBD, setFoundInBD] = useState(false)

  const handleSearch = () => {
    if (!phoneInput.trim()) return
    setSearching(true)

    const digits = phoneInput.replace(/\D/g, "")
    const normalized = digits.startsWith("52") && digits.length > 10 ? digits.slice(2) : digits

    const found = patients.find(p => {
      const pDigits = p.phone.replace(/\D/g, "")
      return pDigits === normalized || pDigits.endsWith(normalized)
    })

    setTimeout(() => {
      setSearching(false)
      setSearched(true)
      if (found) {
        setFoundInBD(true)
        onSelect(found)
      } else {
        setFoundInBD(false)
        // Paciente no registrado: crear entrada manual con el teléfono ya capturado
        onSelect({ id: "manual", fullName: nameInput.trim(), phone: phoneInput })
      }
    }, 400)
  }

  const handleClear = () => {
    setPhoneInput("")
    setNameInput("")
    setSearched(false)
    setFoundInBD(false)
    onSelect(null)
  }

  // Actualizar nombre en tiempo real cuando es manual
  const handleNameChange = (val: string) => {
    setNameInput(val)
    if (searched && !foundInBD) {
      onSelect({ id: "manual", fullName: val.trim(), phone: phoneInput })
    }
  }

  return (
    <div className="space-y-3">
      <Label>Teléfono del paciente</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="+521234567890 o 1234567890"
            value={phoneInput}
            onChange={e => { setPhoneInput(e.target.value); setSearched(false); setFoundInBD(false) }}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="pl-9"
            disabled={searched && foundInBD}
          />
        </div>
        {searched && foundInBD ? (
          <Button variant="outline" size="icon" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSearch} disabled={searching || !phoneInput.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Paciente encontrado en BD */}
      {searched && foundInBD && selected && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="h-8 w-8 rounded-full bg-emerald-200 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-emerald-800 truncate">{selected.fullName}</p>
            <p className="text-xs text-emerald-600">{selected.phone}</p>
          </div>
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        </div>
      )}

      {/* Paciente no registrado: captura manual, se puede guardar igual */}
      {searched && !foundInBD && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span>Paciente no registrado — captura el nombre para el registro (sin notificaciones).</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nombre completo"
                value={nameInput}
                onChange={e => handleNameChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente: autocomplete de tipo de análisis ────────────────────────────
interface ExamTypeSearchProps {
  examTypes: LabExamType[]
  onSelect: (e: LabExamType | null) => void
  selected: LabExamType | null
}

function ExamTypeSearch({ examTypes, onSelect, selected }: ExamTypeSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return examTypes.slice(0, 8)
    const q = query.toLowerCase()
    return examTypes.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.shortCode.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [examTypes, query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  if (selected) {
    return (
      <div className="space-y-1.5">
        <Label>Tipo de análisis</Label>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{selected.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground font-mono">{selected.shortCode}</span>
              <span className="text-xs text-muted-foreground">· {selected.category}</span>
              {selected.defaultCost > 0 && (
                <span className="text-xs text-muted-foreground">· ${selected.defaultCost.toLocaleString()}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onSelect(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label>Tipo de análisis</Label>
      <div className="relative">
        <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar: BHC, glucosa, hormonal..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="pl-9"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full max-w-sm rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {filtered.map(exam => (
            <button
              key={exam.id}
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
              onClick={() => { onSelect(exam); setQuery(""); setOpen(false) }}
            >
              <span className="font-mono text-[10px] text-muted-foreground w-10 shrink-0">{exam.shortCode}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{exam.name}</p>
                <p className="text-xs text-muted-foreground">{exam.category}</p>
              </div>
              {exam.defaultCost > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">${exam.defaultCost.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal: nuevo registro ────────────────────────────────────────────────────
interface NewLabRecordModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  patients: Patient[]
  examTypes: LabExamType[]
}

function NewLabRecordModal({ open, onOpenChange, patients, examTypes }: NewLabRecordModalProps) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [examType, setExamType] = useState<LabExamType | null>(null)
  const [cost, setCost] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill cost from exam type
  useEffect(() => {
    if (examType?.defaultCost) setCost(String(examType.defaultCost))
  }, [examType])

  const resetForm = () => {
    setPatient(null); setExamType(null); setCost(""); setNotes("")
    setDate(new Date().toISOString().split("T")[0]); setError(null)
  }

  const handleClose = (v: boolean) => {
    if (!v) resetForm()
    onOpenChange(v)
  }

  const canSubmit = !!patient && !!examType && !saving &&
    (patient.id !== "manual" || patient.fullName.trim().length >= 2)

  const handleSave = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await addDoc(collection(db, "gynLabRecords"), {
        patientId: patient!.id,
        patientName: patient!.fullName,
        patientPhone: patient!.phone,
        examTypeId: examType!.id,
        examTypeName: examType!.name,
        examTypeCode: examType!.shortCode,
        cost: Number(cost) || 0,
        status: "tomado" as GynLabStatus,
        notes,
        date,
        createdAt: serverTimestamp(),
      })
      handleClose(false)
    } catch (e) {
      setError("Error al guardar. Intenta de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar análisis</DialogTitle>
          <DialogDescription>Busca al paciente por teléfono y selecciona el tipo de estudio.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 relative">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <PatientSearch patients={patients} onSelect={setPatient} selected={patient} />

          <ExamTypeSearch examTypes={examTypes} onSelect={setExamType} selected={examType} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Costo (MXN)</Label>
              <Input
                type="number"
                placeholder="0"
                value={cost}
                onChange={e => setCost(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Indicaciones, observaciones..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Componente principal: Recepción ─────────────────────────────────────────
export function GynLabReception() {
  const [records, setRecords] = useState<GynLabRecord[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [examTypes, setExamTypes] = useState<LabExamType[]>([])
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | GynLabStatus>("all")
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [notifying, setNotifying] = useState<string | null>(null)
  const [notified, setNotified] = useState<Set<string>>(new Set())

  // Suscripciones Firestore
  useEffect(() => {
    const q = query(collection(db, "gynLabRecords"), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as GynLabRecord)))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchPatients = async () => {
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "PACIENTE")))
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)))
    }
    fetchPatients()
  }, [])

  useEffect(() => {
    const q = query(collection(db, "labExamTypes"), orderBy("name"))
    const unsub = onSnapshot(q, snap => {
      setExamTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabExamType)))
    })
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    return records.filter(r => {
      const matchSearch =
        r.patientName.toLowerCase().includes(search.toLowerCase()) ||
        r.examTypeName.toLowerCase().includes(search.toLowerCase()) ||
        r.examTypeCode.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === "all" || r.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [records, search, filterStatus])

  const stats = useMemo(() => ({
    tomado: records.filter(r => r.status === "tomado").length,
    enviado: records.filter(r => r.status === "enviado").length,
    listo: records.filter(r => r.status === "listo").length,
  }), [records])

  const advanceStatus = async (record: GynLabRecord) => {
    const next = STATUS_CONFIG[record.status].next
    if (!next || advancing) return
    setAdvancing(record.id)
    try {
      const update: any = { status: next }

      // Si pasa a "listo" → guardamos fecha de notificación y enviamos notif
      if (next === "listo") {
        update.notifiedAt = new Date().toISOString()
        // Solo notificar si el paciente está registrado en la BD
        if (record.patientId !== "manual") {
          await addDoc(collection(db, "notifications"), {
            userId: record.patientId,
            type: "lab_ready",
            title: "Tu análisis está listo",
            body: `Tu estudio de ${record.examTypeName} ya está disponible para recoger en la clínica.`,
            read: false,
            createdAt: serverTimestamp(),
            labRecordId: record.id,
          })
          setNotified(prev => new Set(prev).add(record.id))
        }
      }

      await updateDoc(doc(db, "gynLabRecords", record.id), update)
    } finally {
      setAdvancing(null)
    }
  }

  const sendNotification = async (record: GynLabRecord) => {
    if (notifying) return
    setNotifying(record.id)
    try {
      await addDoc(collection(db, "notifications"), {
        userId: record.patientId,
        type: "lab_ready",
        title: "Tu análisis está listo",
        body: `Tu estudio de ${record.examTypeName} ya está disponible para recoger en la clínica.`,
        read: false,
        createdAt: serverTimestamp(),
        labRecordId: record.id,
      })
      setNotified(prev => new Set(prev).add(record.id))
    } finally {
      setNotifying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: "tomado", label: "Muestra tomada", color: "text-amber-600", bg: "bg-amber-50" },
          { key: "enviado", label: "En laboratorio", color: "text-blue-600", bg: "bg-blue-50" },
          { key: "listo",  label: "Listos p/ recoger", color: "text-emerald-600", bg: "bg-emerald-50" },
        ] as const).map(s => (
          <Card
            key={s.key}
            className={cn(
              "border-border/50 shadow-sm cursor-pointer transition-all hover:shadow-md",
              filterStatus === s.key && "ring-2 ring-primary/30 border-primary/30"
            )}
            onClick={() => setFilterStatus(filterStatus === s.key ? "all" : s.key)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.bg)}>
                <span className={cn("text-xl font-bold", s.color)}>{stats[s.key]}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente o análisis..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
              <SelectTrigger className="w-44 h-9">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="tomado">Muestra tomada</SelectItem>
                <SelectItem value="enviado">Enviado al lab</SelectItem>
                <SelectItem value="listo">Listo para recoger</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="gap-2 shadow-lg shadow-primary/25 shrink-0" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Nuevo registro
          </Button>
        </CardContent>
      </Card>

      {/* Records */}
      <div 
        id="lab-results-section" 
        className={cn(
          "space-y-2.5 scroll-mt-20", // scroll-mt-20 compensa el sticky header
          filtered.length === 0 && "py-16 text-center border-2 border-dashed rounded-2xl text-muted-foreground"
        )}
      ></div>
      {filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay registros {filterStatus !== "all" ? "con este estado" : ""}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(record => {
            const cfg = STATUS_CONFIG[record.status]
            const isAdvancing = advancing === record.id
            const isNotifying = notifying === record.id
            const wasNotified = notified.has(record.id) || !!record.notifiedAt

            return (
              <Card
                key={record.id}
                className={cn(
                  "border-border/50 shadow-sm transition-all duration-200 hover:shadow-md",
                  record.status === "listo" && "border-emerald-200/60 bg-emerald-50/30"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    {/* Patient + exam info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "h-10 w-10 rounded-xl shrink-0 flex items-center justify-center",
                        record.status === "tomado"  && "bg-amber-100",
                        record.status === "enviado" && "bg-blue-100",
                        record.status === "listo"   && "bg-emerald-100",
                      )}>
                        <FlaskConical className={cn(
                          "h-5 w-5",
                          record.status === "tomado"  && "text-amber-600",
                          record.status === "enviado" && "text-blue-600",
                          record.status === "listo"   && "text-emerald-600",
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-foreground">{record.patientName}</p>
                          <Badge variant="outline" className={cn("text-[10px] border", cfg.badgeClass)}>
                            {cfg.icon}
                            <span className="ml-1">{cfg.label}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground font-medium">{record.examTypeName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {record.examTypeCode}
                          </span>
                          <span className="text-xs text-muted-foreground">{record.date}</span>
                          {record.cost > 0 && (
                            <span className="text-xs text-muted-foreground">${record.cost.toLocaleString()}</span>
                          )}
                        </div>
                        {record.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{record.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                      {/* Notificar manualmente si ya está listo */}
                      {record.status === "listo" && record.patientId !== "manual" && (
                        <Button
                          size="sm"
                          variant={wasNotified ? "outline" : "default"}
                          className={cn(
                            "gap-1.5 text-xs h-8",
                            wasNotified
                              ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                          onClick={() => !wasNotified && sendNotification(record)}
                          disabled={wasNotified || isNotifying}
                        >
                          {isNotifying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : wasNotified ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Bell className="h-3.5 w-3.5" />
                          )}
                          {wasNotified ? "Notificado" : "Notificar"}
                        </Button>
                      )}

                      {/* Avanzar estado */}
                      {cfg.next && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-8 hover:border-primary/40 hover:text-primary"
                          onClick={() => advanceStatus(record)}
                          disabled={isAdvancing}
                        >
                          {isAdvancing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            cfg.nextIcon
                          )}
                          {cfg.nextLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <NewLabRecordModal
        open={newOpen}
        onOpenChange={setNewOpen}
        patients={patients}
        examTypes={examTypes}
      />
    </div>
  )
}