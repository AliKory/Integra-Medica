"use client"

import { useState, useEffect } from "react"
import {
  FlaskConical,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Tag,
  Hash,
  DollarSign,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { db } from "@/lib/firebase"
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore"

export interface LabExamType {
  id: string
  name: string          // Ej: "Biometría Hemática Completa"
  shortCode: string     // Ej: "BHC"
  defaultCost: number
  estimatedDays: number
  category: string      // Ej: "Sangre", "Orina", "Imagen", "Hormonal"
  active: boolean
  createdAt?: any
}

const GYN_CATEGORIES = ["Sangre", "Orina", "Hormonal", "Imagen", "Citología", "Cultivo", "Otro"]

const CATEGORY_COLORS: Record<string, string> = {
  "Sangre":    "bg-rose-100 text-rose-700 border-rose-200",
  "Orina":     "bg-amber-100 text-amber-700 border-amber-200",
  "Hormonal":  "bg-purple-100 text-purple-700 border-purple-200",
  "Imagen":    "bg-blue-100 text-blue-700 border-blue-200",
  "Citología": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Cultivo":   "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Otro":      "bg-muted text-muted-foreground",
}

interface ExamTypeFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing?: LabExamType | null
  onSaved: () => void
}

function ExamTypeForm({ open, onOpenChange, editing, onSaved }: ExamTypeFormProps) {
  const [name, setName] = useState("")
  const [shortCode, setShortCode] = useState("")
  const [defaultCost, setDefaultCost] = useState("")
  const [estimatedDays, setEstimatedDays] = useState("")
  const [category, setCategory] = useState("Sangre")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setShortCode(editing.shortCode)
      setDefaultCost(String(editing.defaultCost))
      setEstimatedDays(String(editing.estimatedDays))
      setCategory(editing.category)
    } else {
      setName(""); setShortCode(""); setDefaultCost(""); setEstimatedDays(""); setCategory("Sangre")
    }
    setError(null)
  }, [editing, open])

  const canSubmit = name.trim().length >= 2 && shortCode.trim().length >= 1 && !saving

  const handleSave = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        shortCode: shortCode.trim().toUpperCase(),
        defaultCost: Number(defaultCost) || 0,
        estimatedDays: Number(estimatedDays) || 1,
        category,
        active: true,
      }
      if (editing) {
        await updateDoc(doc(db, "labExamTypes", editing.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, "labExamTypes"), {
          ...payload,
          createdAt: serverTimestamp(),
        })
      }
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setError("Error al guardar. Intenta de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tipo de análisis" : "Nuevo tipo de análisis"}</DialogTitle>
          <DialogDescription>
            Los tipos de análisis aparecerán como sugerencias al registrar un laboratorio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre del análisis</Label>
              <Input
                placeholder="Ej: Biometría Hemática"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                placeholder="BHC"
                value={shortCode}
                onChange={e => setShortCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {GYN_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border font-medium transition-all",
                    category === cat
                      ? CATEGORY_COLORS[cat] + " ring-2 ring-offset-1 ring-current"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Costo base (MXN)
              </Label>
              <Input
                type="number"
                placeholder="350"
                value={defaultCost}
                onChange={e => setDefaultCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Días estimados
              </Label>
              <Input
                type="number"
                placeholder="3"
                min="1"
                value={estimatedDays}
                onChange={e => setEstimatedDays(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Guardar cambios" : "Crear tipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LabTypesAdmin() {
  const [examTypes, setExamTypes] = useState<LabExamType[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LabExamType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LabExamType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>("all")

  useEffect(() => {
    const q = query(collection(db, "labExamTypes"), orderBy("category"), orderBy("name"))
    const unsub = onSnapshot(q, snap => {
      setExamTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabExamType)))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = filterCategory === "all"
    ? examTypes
    : examTypes.filter(e => e.category === filterCategory)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, "labExamTypes", deleteTarget.id))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const openEdit = (exam: LabExamType) => {
    setEditing(exam)
    setFormOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  // Stats por categoría
  const byCategory = GYN_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = examTypes.filter(e => e.category === cat).length
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <Card
          className={cn(
            "border-border/50 shadow-sm cursor-pointer transition-all hover:shadow-md col-span-1",
            filterCategory === "all" && "ring-2 ring-primary/40 border-primary/40"
          )}
          onClick={() => setFilterCategory("all")}
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{examTypes.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Todos</p>
          </CardContent>
        </Card>
        {GYN_CATEGORIES.map(cat => (
          <Card
            key={cat}
            className={cn(
              "border-border/50 shadow-sm cursor-pointer transition-all hover:shadow-md",
              filterCategory === cat && "ring-2 ring-primary/40 border-primary/40"
            )}
            onClick={() => setFilterCategory(cat)}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{byCategory[cat] ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{cat}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Catálogo de análisis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recepción usará este catálogo para autocompletar al registrar estudios
          </p>
        </div>
        <Button size="sm" className="gap-2 shadow-lg shadow-primary/25" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo tipo
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay tipos de análisis en esta categoría</p>
          <Button variant="link" className="mt-2 text-primary" onClick={openCreate}>Crear el primero</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(exam => (
            <Card key={exam.id} className="border-border/50 shadow-sm hover:shadow-md transition-all duration-200 group">
              <CardContent className="p-4">
                <div className="relative">
                  {/* Botones de acción — posición absoluta para no afectar el layout */}
                  <div className="absolute top-0 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                      onClick={() => openEdit(exam)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(exam)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Contenido principal — sin interferencia de los botones */}
                  <div className="pr-16">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{exam.name}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-mono shrink-0", CATEGORY_COLORS[exam.category])}
                      >
                        {exam.shortCode}
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] mt-1.5 border", CATEGORY_COLORS[exam.category])}
                    >
                      {exam.category}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {exam.defaultCost > 0 ? `$${exam.defaultCost.toLocaleString()}` : "Sin costo"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {exam.estimatedDays} {exam.estimatedDays === 1 ? "día" : "días"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ExamTypeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => {}}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de análisis?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.name}</strong> del catálogo.
              Los registros existentes que usen este tipo no se verán afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}