"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  Search, Plus, Edit, Trash2, ChevronDown, ChevronRight,
  Loader2, Check, Stethoscope, Layers, ImagePlus, X, Upload, Link as LinkIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { db } from "@/lib/firebase"
import {
  collection, onSnapshot, query, orderBy,
  doc, deleteDoc, addDoc, updateDoc, getDocs,
  serverTimestamp,
} from "firebase/firestore"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Service {
  id: string
  name: string
  price: number
  priceMax?: number
  priceVariable?: boolean
  note?: string
  duration?: number
  group?: string
}

interface Category {
  id: string
  name: string
  icon?: string
  description?: string
  requiresLateHour?: boolean
  services: Service[]
  expanded: boolean
}

interface Doctor {
  id: string
  name: string
  specialty: string
  email?: string
  phone?: string
  whatsapp?: string
  doctorAvatar?: string
  isDefault?: boolean
}

// ─── Empty form shapes ────────────────────────────────────────────────────────
const emptyService  = (): Omit<Service,  "id"> => ({ name: "", price: 0, priceMax: 0, priceVariable: false, note: "", duration: undefined, group: "" })
const emptyCategory = (): Omit<Category, "id" | "services" | "expanded"> => ({ name: "", icon: "", description: "", requiresLateHour: false })
const emptyDoctor   = (): Omit<Doctor,   "id"> => ({ name: "", specialty: "", email: "", phone: "", whatsapp: "", isDefault: false })

// ─── Cloudinary upload ────────────────────────────────────────────────────────
async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "integra_medica")

  const res = await fetch("https://api.cloudinary.com/v1_1/dvgpuzpff/image/upload", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || "Error al subir imagen")
  }

  const data = await res.json()
  return data.secure_url as string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ServiceManagement() {
  const [view, setView] = useState<"services" | "doctors">("services")
  const [categories, setCategories] = useState<Category[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Category CRUD
  const [catDialogOpen,  setCatDialogOpen]  = useState(false)
  const [editingCat,     setEditingCat]      = useState<Category | null>(null)
  const [catForm,        setCatForm]         = useState(emptyCategory())
  const [savingCat,      setSavingCat]       = useState(false)

  // Service CRUD
  const [svcDialogOpen,  setSvcDialogOpen]  = useState(false)
  const [editingSvc,     setEditingSvc]      = useState<Service | null>(null)
  const [parentCatId,    setParentCatId]     = useState<string | null>(null)
  const [svcForm,        setSvcForm]         = useState(emptyService())
  const [savingSvc,      setSavingSvc]       = useState(false)

  // Doctor CRUD
  const [docDialogOpen,  setDocDialogOpen]  = useState(false)
  const [editingDoc,     setEditingDoc]      = useState<Doctor | null>(null)
  const [docForm,        setDocForm]         = useState(emptyDoctor())
  const [savingDoc,      setSavingDoc]       = useState(false)

  // Image state (Cloudinary)
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload")
  const [avatarFile,     setAvatarFile]      = useState<File | null>(null)
  const [avatarPreview,  setAvatarPreview]   = useState<string | null>(null)
  const [avatarUrl,      setAvatarUrl]       = useState("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Real-time listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubDocs = onSnapshot(
      query(collection(db, "doctors"), orderBy("name", "asc")),
      snap => setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor)))
    )

    const unsubCats = onSnapshot(
      query(collection(db, "serviceCategories"), orderBy("name", "asc")),
      async snap => {
        const cats: Category[] = await Promise.all(
          snap.docs.map(async catDoc => {
            const svcsSnap = await getDocs(
              query(collection(db, "serviceCategories", catDoc.id, "services"), orderBy("name", "asc"))
            )
            const services: Service[] = svcsSnap.docs.map(s => ({ id: s.id, ...s.data() } as Service))
            return {
              id: catDoc.id,
              ...(catDoc.data() as Omit<Category, "id" | "services" | "expanded">),
              services,
              expanded: prevExpandedRef.current.has(catDoc.id),
            }
          })
        )
        setCategories(cats)
        setLoading(false)
      }
    )

    return () => { unsubDocs(); unsubCats() }
  }, [])

  const prevExpandedRef = useRef<Set<string>>(new Set())
  const toggleExpanded = (catId: string) => {
    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c
      const next = !c.expanded
      if (next) prevExpandedRef.current.add(catId)
      else prevExpandedRef.current.delete(catId)
      return { ...c, expanded: next }
    }))
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase()
    return categories
      .map(cat => ({
        ...cat,
        expanded: true,
        services: cat.services.filter(s =>
          s.name?.toLowerCase().includes(q) ||
          s.note?.toLowerCase().includes(q)
        ),
      }))
      .filter(cat => cat.name?.toLowerCase().includes(q) || cat.services.length > 0)
  }, [categories, searchQuery])

  // ── Image helpers (Cloudinary) ────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const clearAvatarSelection = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarUrl("")
    setImageInputMode("upload")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const resolveAvatarUrl = async (existingUrl: string): Promise<string> => {
    if (imageInputMode === "upload" && avatarFile) {
      setUploadingAvatar(true)
      try {
        return await uploadToCloudinary(avatarFile)
      } catch (err: any) {
        toast.error(err.message || "No se pudo subir la imagen")
        throw err
      } finally {
        setUploadingAvatar(false)
      }
    }
    if (imageInputMode === "url" && avatarUrl.trim()) {
      return avatarUrl.trim()
    }
    return existingUrl
  }

  // ── Category handlers ─────────────────────────────────────────────────────
  const openNewCategory = () => {
    setEditingCat(null)
    setCatForm(emptyCategory())
    setCatDialogOpen(true)
  }

  const openEditCategory = (cat: Category) => {
    setEditingCat(cat)
    setCatForm({ name: cat.name, icon: cat.icon ?? "", description: cat.description ?? "", requiresLateHour: cat.requiresLateHour ?? false })
    setCatDialogOpen(true)
  }

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) return
    setSavingCat(true)
    try {
      const data = { name: catForm.name.trim(), icon: catForm.icon?.trim() ?? "", description: catForm.description?.trim() ?? "", requiresLateHour: catForm.requiresLateHour ?? false }
      if (editingCat) {
        await updateDoc(doc(db, "serviceCategories", editingCat.id), data)
        toast.success("Categoría actualizada")
      } else {
        await addDoc(collection(db, "serviceCategories"), { ...data, createdAt: serverTimestamp() })
        toast.success("Categoría creada")
      }
      setCatDialogOpen(false)
    } catch { toast.error("Error al guardar categoría") }
    finally { setSavingCat(false) }
  }

  const handleDeleteCategory = async (catId: string) => {
    try {
      await deleteDoc(doc(db, "serviceCategories", catId))
      toast.success("Categoría eliminada")
    } catch { toast.error("Error al eliminar") }
  }

  // ── Service handlers ──────────────────────────────────────────────────────
  const openNewService = (catId: string) => {
    setEditingSvc(null)
    setParentCatId(catId)
    setSvcForm(emptyService())
    setSvcDialogOpen(true)
  }

  const openEditService = (catId: string, svc: Service) => {
    setEditingSvc(svc)
    setParentCatId(catId)
    setSvcForm({ name: svc.name, price: svc.price, priceMax: svc.priceMax ?? 0, priceVariable: svc.priceVariable ?? false, note: svc.note ?? "", duration: svc.duration, group: svc.group ?? "" })
    setSvcDialogOpen(true)
  }

  const handleSaveService = async () => {
    if (!svcForm.name.trim() || !parentCatId) return
    setSavingSvc(true)
    try {
      const data: Omit<Service, "id"> = {
        name:          svcForm.name.trim(),
        price:         Number(svcForm.price) || 0,
        priceMax:      svcForm.priceVariable ? (Number(svcForm.priceMax) || 0) : 0,
        priceVariable: svcForm.priceVariable ?? false,
        note:          svcForm.note?.trim() ?? "",
        group:         svcForm.group?.trim() ?? "",
        ...(svcForm.duration ? { duration: Number(svcForm.duration) } : {}),
      }
      const collRef = collection(db, "serviceCategories", parentCatId, "services")
      if (editingSvc) {
        await updateDoc(doc(collRef, editingSvc.id), data as Record<string, unknown>)
        toast.success("Servicio actualizado")
      } else {
        await addDoc(collRef, { ...data, createdAt: serverTimestamp() })
        toast.success("Servicio creado")
      }
      setSvcDialogOpen(false)
    } catch { toast.error("Error al guardar servicio") }
    finally { setSavingSvc(false) }
  }

  const handleDeleteService = async (catId: string, svcId: string) => {
    try {
      await deleteDoc(doc(db, "serviceCategories", catId, "services", svcId))
      toast.success("Servicio eliminado")
    } catch { toast.error("Error al eliminar") }
  }

  // ── Doctor handlers ───────────────────────────────────────────────────────
  const openNewDoctor = () => {
    setEditingDoc(null)
    setDocForm(emptyDoctor())
    clearAvatarSelection()
    setDocDialogOpen(true)
  }

  const openEditDoctor = (doctor: Doctor) => {
    setEditingDoc(doctor)
    setDocForm({ name: doctor.name, specialty: doctor.specialty, email: doctor.email ?? "", phone: doctor.phone ?? "", whatsapp: doctor.whatsapp ?? "", doctorAvatar: doctor.doctorAvatar ?? "", isDefault: doctor.isDefault ?? false })
    clearAvatarSelection()
    if (doctor.doctorAvatar) {
      setAvatarPreview(doctor.doctorAvatar)
      setAvatarUrl(doctor.doctorAvatar)
      setImageInputMode("url")
    }
    setDocDialogOpen(true)
  }

  const handleSaveDoctor = async () => {
  if (!docForm.name.trim() || !docForm.specialty.trim()) return

  setSavingDoc(true)

  try {
    const finalAvatarUrl = await resolveAvatarUrl(docForm.doctorAvatar ?? "")

    const data = {
      name: docForm.name.trim(),
      specialty: docForm.specialty.trim(),
      email: docForm.email?.trim() ?? "",
      phone: docForm.phone?.trim() ?? "",
      whatsapp: docForm.whatsapp?.trim() ?? "",
      doctorAvatar: finalAvatarUrl,
      isDefault: docForm.isDefault ?? false,
      updatedAt: serverTimestamp(),
    }

    // 🔥 LÓGICA DE "SOLO UN MÉDICO PRINCIPAL"
    if (docForm.isDefault) {
      // Quitar isDefault de todos los demás médicos
      const allDoctorsSnap = await getDocs(collection(db, "doctors"))
      const batchPromises = allDoctorsSnap.docs
        .filter(d => d.id !== editingDoc?.id) // no tocar el que estamos editando
        .map(d => 
          updateDoc(doc(db, "doctors", d.id), { isDefault: false })
        )

      await Promise.all(batchPromises)
    }

    if (editingDoc) {
      await updateDoc(doc(db, "doctors", editingDoc.id), data)
      toast.success("Médico actualizado correctamente")
    } else {
      await addDoc(collection(db, "doctors"), { 
        ...data, 
        createdAt: serverTimestamp() 
      })
      toast.success("Médico creado correctamente")
    }

    setDocDialogOpen(false)
    clearAvatarSelection()
  } catch (error) {
    console.error(error)
    toast.error("Error al guardar el médico")
  } finally {
    setSavingDoc(false)
  }
}

  const handleDeleteDoctor = async (id: string) => {
    try {
      await deleteDoc(doc(db, "doctors", id))
      toast.success("Médico eliminado")
    } catch { toast.error("Error al eliminar") }
  }

  // ── Price display ─────────────────────────────────────────────────────────
  const formatPrice = (svc: Service) => {
    if (svc.priceVariable && svc.priceMax) return `$${svc.price.toLocaleString()} – $${svc.priceMax.toLocaleString()}`
    return `$${svc.price.toLocaleString()}`
  }

  const currentAvatarSrc = avatarPreview ?? docForm.doctorAvatar ?? ""

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-12">

      {/* View toggle & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Toggles más separados y color activo rojo */}
        <div className="flex flex-wrap gap-3">
          {(["services", "doctors"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all border",
                view === v
                  ? "bg-red-500 text-white border-red-500 shadow-md hover:bg-red-600"
                  : "bg-background text-muted-foreground border-border/50 hover:border-border hover:text-foreground hover:bg-muted/50"
              )}
            >
              {v === "services" ? <Layers className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
              {v === "services" ? "Servicios" : "Médicos"}
            </button>
          ))}
        </div>

        {view === "services" ? (
          <Button onClick={openNewCategory} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
        ) : (
          <Button onClick={openNewDoctor} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo médico
          </Button>
        )}
      </div>

      {/* ── SERVICES VIEW ───────────────────────────────────────────────── */}
      {view === "services" && (
        <div className="space-y-6">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar servicio o categoría..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredCategories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl">
              <Layers className="h-10 w-10 mb-2 opacity-20" />
              <p className="font-medium">No hay categorías aún</p>
              <p className="text-sm">Crea una categoría para empezar</p>
            </div>
          )}

          {filteredCategories.map(cat => (
            <div key={cat.id} className="rounded-2xl border border-border/60 overflow-hidden shadow-sm mb-6">
              {/* Category header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                <button
                  onClick={() => toggleExpanded(cat.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  {cat.expanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  {cat.icon && <span className="text-2xl leading-none">{cat.icon}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{cat.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mr-2">
                    <Badge variant="secondary">
                      {cat.services.length} servicio{cat.services.length !== 1 ? "s" : ""}
                    </Badge>
                    {cat.requiresLateHour && (
                      <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">Solo tarde</Badge>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => openNewService(cat.id)}
                    title="Agregar servicio"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => openEditCategory(cat)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive active:text-white transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar categoría</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Eliminar "{cat.name}"? Los servicios dentro de esta categoría también serán eliminados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Services list */}
              {cat.expanded && (
                <div className="divide-y divide-border/40">
                  {cat.services.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                      <p>Sin servicios en esta categoría</p>
                      <button onClick={() => openNewService(cat.id)} className="text-primary hover:underline flex items-center gap-1 text-xs font-medium">
                        <Plus className="h-3 w-3" /> Agregar servicio
                      </button>
                    </div>
                  ) : (
                    cat.services.map(svc => (
                      <div
                        key={svc.id}
                        className="flex items-center gap-4 px-6 py-4 bg-card hover:bg-muted/20 transition-colors group"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground">{svc.name}</span>
                            {svc.group && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{svc.group}</Badge>
                            )}
                            {svc.priceVariable && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">Variable</Badge>
                            )}
                          </div>
                          {svc.note && <p className="text-xs text-muted-foreground">{svc.note}</p>}
                          {svc.duration && <p className="text-xs text-muted-foreground">⏱ {svc.duration} min</p>}
                        </div>

                        <span className="text-sm font-bold text-emerald-600 shrink-0 tabular-nums">
                          {formatPrice(svc)}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => openEditService(cat.id, svc)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive active:text-white transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Eliminar "{svc.name}"? Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteService(cat.id, svc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))
                  )}

                  {cat.services.length > 0 && (
                    <button
                      onClick={() => openNewService(cat.id)}
                      className="flex items-center gap-2 w-full px-6 py-4 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors font-medium"
                    >
                      <Plus className="h-3 w-3" /> Agregar servicio a {cat.name}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── DOCTORS VIEW ────────────────────────────────────────────────── */}
      {view === "doctors" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {doctors.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl">
              <Stethoscope className="h-10 w-10 mb-2 opacity-20" />
              <p className="font-medium">No hay médicos registrados</p>
            </div>
          )}

          {doctors.map(doctor => (
            <Card key={doctor.id} className="border-border/50 overflow-hidden hover:shadow-lg transition-all duration-200">
              <CardContent className="p-0">
                <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 px-8 pt-10 pb-8 flex flex-col items-center text-center gap-4">
                  
                  {/* Contenedor relativo para el Avatar y el Badge Principal */}
                  <div className="relative">
                    {doctor.isDefault && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-100 hover:bg-red-200 text-red-700 text-[10px] uppercase z-10 whitespace-nowrap shadow-sm">
                        ★ MÉDICO PRINCIPAL
                      </Badge>
                    )}
                    {/* Imagen más pequeña h-20 w-20 */}
                    <Avatar className="h-20 w-20 rounded-full border-4 border-background shadow-md">
                      <AvatarImage src={doctor.doctorAvatar} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                        {doctor.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-lg leading-tight">{doctor.name}</p>
                    <p className="text-sm text-primary font-semibold">{doctor.specialty}</p>
                  </div>
                </div>

                {(doctor.email || doctor.phone || doctor.whatsapp) && (
                  <div className="px-6 py-5 space-y-4 border-t border-border/40">
                    {doctor.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-3 truncate">
                        <span className="text-base shrink-0">✉</span>
                        <span className="truncate">{doctor.email}</span>
                      </p>
                    )}
                    {doctor.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-3">
                        <span className="text-base shrink-0">📞</span>
                        {doctor.phone}
                      </p>
                    )}
                    {doctor.whatsapp && (
                      <p className="text-sm text-muted-foreground flex items-center gap-3">
                        <span className="text-base shrink-0">💬</span>
                        {doctor.whatsapp}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 px-6 py-5 border-t border-border/40 bg-muted/20 pb-2">
                  <Button
                    variant="outline" size="sm" className="flex-1 gap-1.5 text-sm bg-background"
                    onClick={() => openEditDoctor(doctor)}
                  >
                    <Edit className="h-3.5 w-3.5" /> Editar
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        className="text-destructive border-destructive/30 bg-background hover:bg-destructive hover:text-white active:bg-destructive active:text-white transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar médico</AlertDialogTitle>
                        <AlertDialogDescription>¿Eliminar a {doctor.name}? Esta acción no se puede deshacer.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteDoctor(doctor.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════════════════════════════════ */}

      {/* Category dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        {/* Cambiado a flex-col y height fijo para que su cuerpo pueda scrollear */}
        <DialogContent className="max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{editingCat ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2 col-span-1">
                <Label>Ícono</Label>
                <Input
                  placeholder="🩺"
                  value={catForm.icon ?? ""}
                  onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                  className="text-center text-xl"
                />
              </div>
              <div className="space-y-2 col-span-3">
                <Label>Nombre *</Label>
                <Input
                  placeholder="Biopsias, Ultrasonidos..."
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción breve de la categoría"
                value={catForm.description ?? ""}
                onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Solo horario vespertino</p>
                <p className="text-xs text-muted-foreground">Disponible únicamente después de las 4:30 PM</p>
              </div>
              <Switch
                checked={catForm.requiresLateHour ?? false}
                onCheckedChange={v => setCatForm(f => ({ ...f, requiresLateHour: v }))}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCategory} disabled={savingCat || !catForm.name.trim()}>
              {savingCat ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service dialog */}
      <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{editingSvc ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            <div className="space-y-2">
              <Label>Nombre del servicio *</Label>
              <Input
                placeholder="Ej. Consulta general"
                value={svcForm.name}
                onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            
            <div className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Precio variable</p>
                <p className="text-xs text-muted-foreground">El precio tiene un rango (min - max)</p>
              </div>
              <Switch
                checked={svcForm.priceVariable ?? false}
                onCheckedChange={v => setSvcForm(f => ({ ...f, priceVariable: v }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{svcForm.priceVariable ? "Precio mínimo *" : "Precio *"}</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={svcForm.price || ""}
                  onChange={e => setSvcForm(f => ({ ...f, price: Number(e.target.value) }))}
                />
              </div>
              {svcForm.priceVariable && (
                <div className="space-y-2">
                  <Label>Precio máximo *</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={svcForm.priceMax || ""}
                    onChange={e => setSvcForm(f => ({ ...f, priceMax: Number(e.target.value) }))}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duración (minutos)</Label>
                <Input
                  type="number"
                  placeholder="Ej. 30"
                  value={svcForm.duration || ""}
                  onChange={e => setSvcForm(f => ({ ...f, duration: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Grupo / Etiqueta</Label>
                <Input
                  placeholder="Ej. Promoción"
                  value={svcForm.group ?? ""}
                  onChange={e => setSvcForm(f => ({ ...f, group: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nota / Detalles</Label>
              <Textarea
                placeholder="Información extra que el paciente debe saber..."
                value={svcForm.note ?? ""}
                onChange={e => setSvcForm(f => ({ ...f, note: e.target.value }))}
                className="resize-none h-20"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setSvcDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveService} disabled={savingSvc || !svcForm.name.trim()}>
              {savingSvc ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor dialog */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        {/* Aquí está la barra deslizante independiente para el cuerpo del formulario */}
        <DialogContent className="max-w-xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{editingDoc ? "Editar médico" : "Nuevo médico"}</DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* Image section */}
            <div className="space-y-3 bg-muted/30 p-5 rounded-2xl border border-border/50">
              <Label className="text-base font-semibold">Foto de perfil</Label>
              <div className="flex items-center gap-3 mb-4">
                <Button
                  type="button"
                  variant={imageInputMode === "upload" ? "default" : "outline"}
                  onClick={() => setImageInputMode("upload")}
                  className="flex-1 gap-2"
                >
                  <Upload className="h-4 w-4" /> Subir archivo
                </Button>
                <Button
                  type="button"
                  variant={imageInputMode === "url" ? "default" : "outline"}
                  onClick={() => setImageInputMode("url")}
                  className="flex-1 gap-2"
                >
                  <LinkIcon className="h-4 w-4" /> Usar URL
                </Button>
              </div>

              {imageInputMode === "upload" ? (
                <div className="space-y-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="cursor-pointer file:cursor-pointer"
                  />
                  {currentAvatarSrc && imageInputMode === "upload" && (
                    <div className="relative mx-auto w-32 h-32 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-sm group">
                      <img src={currentAvatarSrc} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        onClick={clearAvatarSelection}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    placeholder="https://ejemplo.com/imagen.jpg"
                    value={avatarUrl}
                    onChange={(e) => {
                      setAvatarUrl(e.target.value)
                      setAvatarPreview(e.target.value)
                    }}
                  />
                  {currentAvatarSrc && imageInputMode === "url" && (
                    <div className="relative mx-auto w-32 h-32 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-sm group">
                      <img
                        src={currentAvatarSrc}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                      <button
                        onClick={clearAvatarSelection}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Nombre completo *</Label>
                <Input
                  placeholder="Ej. Dr. Juan Pérez"
                  value={docForm.name}
                  onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Especialidad *</Label>
                <Input
                  placeholder="Ej. Cardiólogo"
                  value={docForm.specialty}
                  onChange={e => setDocForm(f => ({ ...f, specialty: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="Opcional"
                  value={docForm.phone ?? ""}
                  onChange={e => setDocForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  placeholder="Opcional"
                  value={docForm.whatsapp ?? ""}
                  onChange={e => setDocForm(f => ({ ...f, whatsapp: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  placeholder="Opcional"
                  value={docForm.email ?? ""}
                  onChange={e => setDocForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Médico principal / Destacado</p>
                <p className="text-xs text-muted-foreground">Se resaltará de forma diferente en la aplicación.</p>
              </div>
              <Switch
                checked={docForm.isDefault ?? false}
                onCheckedChange={v => setDocForm(f => ({ ...f, isDefault: v }))}
              />
            </div>

          </div>
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDoctor} disabled={savingDoc || uploadingAvatar || !docForm.name.trim() || !docForm.specialty.trim()}>
              {(savingDoc || uploadingAvatar) ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              {uploadingAvatar ? "Subiendo foto..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}