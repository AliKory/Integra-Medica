"use client"

import { useState, useEffect, useMemo } from "react"
import {
  FlaskConical,
  ArrowLeft,
  Download,
  Eye,
  Search,
  Filter,
  FileText,
  Loader2,
  Clock,
  CheckCircle2,
  Package,
  Send,
  UserCheck,
  Calendar,
  DollarSign,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { db, auth } from "@/lib/firebase"
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import Link from "next/link"

type LabStatus = "sent" | "received" | "processing" | "ready" | "delivered"

interface LabResult {
  id: string
  analysisType: string
  lab: string
  sentDate: string
  cost: number
  status: LabStatus
  notes?: string
  resultUrl?: string
  resultDate?: string
}

const statusConfig: Record<LabStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  sent: { label: "Enviado", color: "text-blue-700", bgColor: "bg-blue-100 border-blue-200", icon: <Send className="h-3.5 w-3.5" /> },
  received: { label: "Recibido", color: "text-indigo-700", bgColor: "bg-indigo-100 border-indigo-200", icon: <Package className="h-3.5 w-3.5" /> },
  processing: { label: "En Proceso", color: "text-amber-700", bgColor: "bg-amber-100 border-amber-200", icon: <Clock className="h-3.5 w-3.5" /> },
  ready: { label: "Listo", color: "text-emerald-700", bgColor: "bg-emerald-100 border-emerald-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  delivered: { label: "Entregado", color: "text-muted-foreground", bgColor: "bg-muted border-muted-foreground/20", icon: <UserCheck className="h-3.5 w-3.5" /> },
}

export function MyLabResultsPage() {
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null)

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)
      } else {
        setUserId(null)
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  // Subscribe to lab results for current user
  useEffect(() => {
    if (!userId) return

    const q = query(
      collection(db, "labRecords"),
      where("patientId", "==", userId),
      orderBy("sentDate", "desc")
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: LabResult[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data()
        results.push({
          id: docSnap.id,
          analysisType: data.analysisType,
          lab: data.lab,
          sentDate: data.sentDate,
          cost: data.cost || 0,
          status: data.status,
          notes: data.notes,
          resultUrl: data.resultUrl,
          resultDate: data.resultDate,
        })
      })
      setLabResults(results)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userId])

  const filteredResults = useMemo(() => {
    return labResults.filter((result) => {
      const matchSearch =
        result.analysisType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.lab.toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = filterStatus === "all" || result.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [labResults, searchQuery, filterStatus])

  const stats = useMemo(() => ({
    total: labResults.length,
    ready: labResults.filter((r) => r.status === "ready").length,
    inProgress: labResults.filter((r) => ["sent", "received", "processing"].includes(r.status)).length,
    totalCost: labResults.reduce((acc, r) => acc + r.cost, 0),
  }), [labResults])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FlaskConical className="h-12 w-12 mb-4 text-muted-foreground opacity-40" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Inicia sesion</h2>
            <p className="text-sm text-muted-foreground mb-4">Necesitas iniciar sesion para ver tus resultados de laboratorio</p>
            <Button asChild>
              <Link href="/login">Iniciar Sesion</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex h-16 items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Mis Laboratorios</h1>
                <p className="text-xs text-muted-foreground">Historial de estudios y resultados</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Estudios", value: stats.total, icon: <FlaskConical className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10" },
            { label: "Listos", value: stats.ready, icon: <CheckCircle2 className="h-5 w-5" />, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "En Proceso", value: stats.inProgress, icon: <Clock className="h-5 w-5" />, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Total Invertido", value: `$${stats.totalCost.toLocaleString()}`, icon: <DollarSign className="h-5 w-5" />, color: "text-blue-600", bg: "bg-blue-50" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50 shadow-sm">
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

        {/* Filters */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tipo de estudio o laboratorio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="received">Recibido</SelectItem>
                  <SelectItem value="processing">En Proceso</SelectItem>
                  <SelectItem value="ready">Listo</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {filteredResults.length === 0 ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FlaskConical className="h-16 w-16 mb-4 opacity-40" />
              <p className="text-lg font-medium">No hay estudios de laboratorio</p>
              <p className="text-sm">Tus resultados apareceran aqui cuando tengas estudios</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredResults.map((result, index) => (
              <Card
                key={result.id}
                className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                onClick={() => setSelectedResult(result)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Icon */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-6 w-6" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{result.analysisType}</h3>
                        <Badge variant="outline" className="text-xs">{result.lab}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(result.sentDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>${result.cost.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn("gap-1 border", statusConfig[result.status]?.bgColor, statusConfig[result.status]?.color)}
                      >
                        {statusConfig[result.status]?.icon}
                        {statusConfig[result.status]?.label}
                      </Badge>

                      {result.resultUrl && (result.status === "ready" || result.status === "delivered") && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-blue-600 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(result.resultUrl, "_blank")
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-emerald-600 hover:bg-emerald-50"
                            onClick={(e) => e.stopPropagation()}
                            asChild
                          >
                            <a href={result.resultUrl} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del Estudio</DialogTitle>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">{selectedResult.analysisType}</h3>
                  <p className="text-sm text-muted-foreground">{selectedResult.lab}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Fecha de Envio</p>
                  <p className="font-medium text-foreground">{formatDate(selectedResult.sentDate)}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Costo</p>
                  <p className="font-medium text-foreground">${selectedResult.cost.toLocaleString()}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Estado</p>
                <Badge
                  variant="outline"
                  className={cn("gap-1 border mt-1", statusConfig[selectedResult.status]?.bgColor, statusConfig[selectedResult.status]?.color)}
                >
                  {statusConfig[selectedResult.status]?.icon}
                  {statusConfig[selectedResult.status]?.label}
                </Badge>
              </div>

              {selectedResult.notes && (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm text-foreground">{selectedResult.notes}</p>
                </div>
              )}

              {selectedResult.resultUrl && (selectedResult.status === "ready" || selectedResult.status === "delivered") && (
                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => window.open(selectedResult.resultUrl, "_blank")}
                  >
                    <Eye className="h-4 w-4" />
                    Ver Resultado
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" asChild>
                    <a href={selectedResult.resultUrl} download>
                      <Download className="h-4 w-4" />
                      Descargar PDF
                    </a>
                  </Button>
                </div>
              )}

              {!selectedResult.resultUrl && selectedResult.status !== "ready" && selectedResult.status !== "delivered" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <Clock className="h-8 w-8 mx-auto text-amber-600 mb-2" />
                  <p className="text-sm font-medium text-amber-800">Resultado en proceso</p>
                  <p className="text-xs text-amber-600 mt-1">Te notificaremos cuando este listo</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
