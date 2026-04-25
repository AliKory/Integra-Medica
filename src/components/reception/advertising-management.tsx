"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  Megaphone,
  Plus,
  Edit3,
  Trash2,
  Eye,
  MousePointerClick,
  ImageIcon,
  Calendar,
  Link2,
  Power,
  PowerOff,
  TrendingUp,
  Loader2,
  Upload,
  AlertCircle,
  LinkIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  increment,
} from "firebase/firestore"

// ─── Types ─────────────────────────────────────────────────────────────
export interface AdCampaign {
  id: string
  title: string
  description: string
  imageUrl: string
  link: string
  startDate: string
  endDate: string
  position: number
  active: boolean
  views: number
  clicks: number
  createdAt?: Date
}

// ─── Helper para incrementar vistas/clics ───────────────────────────────
// FIX: Esta función hace un increment atómico en Firestore, lo que garantiza
// que el contador sea siempre preciso, incluso con múltiples usuarios simultáneos.
export async function incrementCampaignStat(
  campaignId: string,
  field: "views" | "clicks"
) {
  try {
    await updateDoc(doc(db, "campaigns", campaignId), {
      [field]: increment(1),
    })
  } catch (error) {
    console.error("Error incrementing stat:", error)
  }
}

// ─── Componente Principal ───────────────────────────────────────────────
export function AdvertisingManagement() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload")
  const [formImageUrl, setFormImageUrl] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formLink, setFormLink] = useState("")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formPosition, setFormPosition] = useState(1)
  const [formActive, setFormActive] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // ── Suscripción a Firestore ──────────────────────────────────────────
  // FIX: onSnapshot mantiene los datos siempre sincronizados con Firestore en
  // tiempo real, incluyendo views y clicks. El contador que se muestra en las
  // cards refleja exactamente lo que hay en la base de datos.
  useEffect(() => {
    const q = query(collection(db, "campaigns"), orderBy("position", "asc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const campaignsData: AdCampaign[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AdCampaign, "id">),
      }))
      setCampaigns(campaignsData)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const stats = useMemo(() => ({
    total: campaigns.length,
    active: campaigns.filter((c) => c.active).length,
    totalViews: campaigns.reduce((acc, c) => acc + (c.views || 0), 0),
    totalClicks: campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0),
  }), [campaigns])

  const ctr = stats.totalViews > 0
    ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1)
    : "0"

  // ─── Upload a Cloudinary ─────────────────────────────────────────────
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", "integra_medica")

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dvgpuzpff/image/upload",
        {
          method: "POST",
          body: formData,
        }
      )

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error?.message || "Error al subir a Cloudinary")
      }

      const data = await res.json()
      return data.secure_url
    } catch (err: any) {
      console.error("Cloudinary upload error:", err)
      throw new Error(err.message || "No se pudo subir la imagen a Cloudinary")
    }
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, "campaigns", id), { active: !currentActive })
    } catch (error) {
      console.error("Error toggling campaign:", error)
    }
  }

  const deleteCampaign = async (id: string) => {
    try {
      await deleteDoc(doc(db, "campaigns", id))
    } catch (error) {
      console.error("Error deleting campaign:", error)
    }
  }

  const resetForm = () => {
    setFormTitle("")
    setFormDescription("")
    setFormLink("")
    setFormStartDate(new Date().toISOString().split("T")[0])
    setFormEndDate("")
    setFormPosition(campaigns.length + 1)
    setFormActive(true)
    setSelectedFile(null)
    setPreviewImage(null)
    setFormImageUrl("")
    setUploadError(null)
    setImageInputMode("upload")
    setUploadingImage(false)
  }

  const openNewCampaign = () => {
    setEditingCampaign(null)
    resetForm()
    setEditOpen(true)
  }

  // FIX: Al editar, si la imagen viene de Cloudinary (URL) se mantiene el modo
  // "url" con la URL actual cargada. El usuario puede cambiarla si quiere subir
  // una nueva imagen, o simplemente guardar para conservar la existente.
  const openEditCampaign = (campaign: AdCampaign) => {
    setEditingCampaign(campaign)
    setFormTitle(campaign.title)
    setFormDescription(campaign.description)
    setFormLink(campaign.link)
    setFormStartDate(campaign.startDate)
    setFormEndDate(campaign.endDate)
    setFormPosition(campaign.position)
    setFormActive(campaign.active)
    setSelectedFile(null)
    setUploadError(null)

    if (campaign.imageUrl) {
      // Mostrar la imagen existente como preview y cargar en modo URL
      setPreviewImage(campaign.imageUrl)
      setFormImageUrl(campaign.imageUrl)
      setImageInputMode("url")
    } else {
      setPreviewImage(null)
      setFormImageUrl("")
      setImageInputMode("upload")
    }

    setEditOpen(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = () => setPreviewImage(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  // ─── Guardar Campaña ─────────────────────────────────────────────────
  // FIX: Al guardar una edición, si el usuario no cambió la imagen se conserva
  // la URL existente. Los campos views y clicks se preservan desde Firestore
  // y NO se sobreescriben, evitando resetear los contadores al editar.
  const handleSave = async () => {
    if (!formTitle.trim()) return

    setSaving(true)
    setUploadError(null)

    try {
      let imageUrl = editingCampaign?.imageUrl ?? ""

      if (imageInputMode === "upload" && selectedFile) {
        setUploadingImage(true)
        imageUrl = await uploadToCloudinary(selectedFile)
      } else if (imageInputMode === "url" && formImageUrl.trim()) {
        imageUrl = formImageUrl.trim()
      } else if (!imageUrl) {
        throw new Error("Debes subir una imagen o pegar una URL")
      }

      const campaignData = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        imageUrl,
        link: formLink.trim(),
        startDate: formStartDate,
        endDate: formEndDate || "",
        position: formPosition,
        active: formActive,
        // FIX: No incluimos views/clicks aquí para no sobreescribirlos.
        // updateDoc solo actualiza los campos especificados, los demás se conservan.
      }

      if (editingCampaign) {
        await updateDoc(doc(db, "campaigns", editingCampaign.id), campaignData)
      } else {
        await addDoc(collection(db, "campaigns"), {
          ...campaignData,
          views: 0,
          clicks: 0,
          createdAt: serverTimestamp(),
        })
      }

      setEditOpen(false)
      resetForm()
    } catch (error: any) {
      console.error("Error saving campaign:", error)
      setUploadError(error.message || "Error al guardar la campaña")
    } finally {
      setSaving(false)
      setUploadingImage(false)
    }
  }

  const isExpired = (endDate: string) =>
    endDate ? new Date(endDate) < new Date() : false

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Campañas", value: stats.total, icon: <Megaphone className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10" },
          { label: "Activas", value: stats.active, icon: <Power className="h-5 w-5" />, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Vistas", value: stats.totalViews.toLocaleString(), icon: <Eye className="h-5 w-5" />, color: "text-blue-600", bg: "bg-blue-50" },
          { label: `CTR ${ctr}%`, value: stats.totalClicks.toLocaleString(), icon: <MousePointerClick className="h-5 w-5" />, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", stat.bg, stat.color)}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          Campañas Publicitarias
        </h3>
        <Button onClick={openNewCampaign} className="gap-2 shadow-lg shadow-primary/25">
          <Plus className="h-4 w-4" />
          Nueva Campaña
        </Button>
      </div>

      {/* Lista de Campañas */}
      {campaigns.length === 0 ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Megaphone className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">No hay campañas publicitarias</p>
            <p className="text-sm">Crea tu primera campaña para mostrar a los pacientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className={cn("border-border/50 shadow-sm overflow-hidden hover:shadow-md group", !campaign.active && "opacity-70")}>
              {/* Imagen */}
              <div className="relative h-40 overflow-hidden bg-muted">
                {campaign.imageUrl ? (
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <div className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-lg bg-card/90 text-foreground text-sm font-bold shadow-lg backdrop-blur-sm">
                  {campaign.position}
                </div>

                <div className="absolute top-3 right-3 flex gap-2">
                  {isExpired(campaign.endDate) && <Badge className="bg-red-500/90 text-white">Expirada</Badge>}
                  <Badge className={cn("border-0 text-xs", campaign.active ? "bg-emerald-500/90" : "bg-muted-foreground/70")}>
                    {campaign.active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h4 className="text-white font-semibold text-base truncate">{campaign.title}</h4>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{campaign.description}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{campaign.startDate} — {campaign.endDate}</span>
                  </div>
                  {campaign.link && (
                    <div className="flex items-center gap-1">
                      <Link2 className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[180px]">{campaign.link}</span>
                    </div>
                  )}
                </div>

                {/* FIX: Los contadores se leen directo del estado que onSnapshot
                    mantiene sincronizado con Firestore, así siempre son correctos. */}
                <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{(campaign.views || 0).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">vistas</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <MousePointerClick className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">{(campaign.clicks || 0).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">clics</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("gap-1.5 flex-1", campaign.active ? "border-emerald-300 text-emerald-700" : "text-muted-foreground")}
                    onClick={() => toggleActive(campaign.id, campaign.active)}
                  >
                    {campaign.active ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                    {campaign.active ? "Activa" : "Inactiva"}
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => openEditCampaign(campaign)}>
                    <Edit3 className="h-3.5 w-3.5" /> Editar
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Campaña</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Estás seguro de eliminar la campaña "{campaign.title}"? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCampaign(campaign.id)} className="bg-destructive">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Editar Campaña" : "Nueva Campaña Publicitaria"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4 max-h-[65vh] overflow-y-auto pr-2">
            {/* Título */}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input placeholder="Título de la campaña" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea placeholder="Descripción del contenido..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
            </div>

            {/* Imagen */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Imagen / Banner</Label>
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => { setImageInputMode("upload"); setFormImageUrl(""); setSelectedFile(null); setPreviewImage(null) }}
                    className={cn("px-3 py-1 transition-colors", imageInputMode === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    <Upload className="inline h-3 w-3 mr-1" /> Subir archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImageInputMode("url"); setSelectedFile(null) }}
                    className={cn("px-3 py-1 transition-colors", imageInputMode === "url" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    <LinkIcon className="inline h-3 w-3 mr-1" /> Pegar URL
                  </button>
                </div>
              </div>

              {imageInputMode === "upload" ? (
                <div
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewImage ? (
                    <img src={previewImage} alt="Preview" className="h-32 w-full object-cover rounded-lg mx-auto" />
                  ) : (
                    <div className="py-6">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Haz clic para subir imagen</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WebP • Máx 5MB</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="https://..."
                    value={formImageUrl}
                    onChange={(e) => {
                      setFormImageUrl(e.target.value)
                      setPreviewImage(e.target.value || null)
                    }}
                  />
                  {/* FIX: Mostrar preview de la imagen actual cuando se está editando */}
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="h-32 w-full object-cover rounded-lg"
                      onError={() => setPreviewImage(null)}
                    />
                  )}
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>

            {uploadError && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <div>{uploadError}</div>
              </div>
            )}

            {/* Enlace */}
            <div className="space-y-2">
              <Label>Enlace (opcional)</Label>
              <Input placeholder="https://..." value={formLink} onChange={(e) => setFormLink(e.target.value)} />
            </div>

            {/* Fechas y Posición */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Inicio</Label>
                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Fin</Label>
                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Posición en Rotación</Label>
              <Input type="number" min={1} value={formPosition} onChange={(e) => setFormPosition(Number(e.target.value))} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Campaña activa</p>
                <p className="text-xs text-muted-foreground">Mostrar esta campaña a los pacientes</p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingImage ? "Subiendo..." : "Guardando..."}
                </>
              ) : editingCampaign ? (
                "Guardar Cambios"
              ) : (
                "Crear Campaña"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}