"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight, Loader2, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { db, auth } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  increment,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"
import { type AdCampaign } from "../reception/advertising-management"

interface BannerCarouselProps {
  isLoaded: boolean
}

export function BannerCarousel({ isLoaded }: BannerCarouselProps) {
  const [banners, setBanners] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // ─────────────────────────────────────────────────────────────
  // Helper: track vista única por usuario o por dispositivo
  // ─────────────────────────────────────────────────────────────
  const trackViewById = useCallback(async (bannerId: string) => {
    try {
      if (typeof window === "undefined") return

      const currentUser = auth.currentUser

      // ── Caso 1: Usuario autenticado → 1 vista única por campaña ──
      if (currentUser?.uid) {
        const q = query(
          collection(db, "campaign_views"),
          where("campaignId", "==", bannerId),
          where("userId", "==", currentUser.uid)
        )

        const existing = await getDocs(q)

        if (!existing.empty) return // Ya se contó esta vista para este usuario

        await addDoc(collection(db, "campaign_views"), {
          campaignId: bannerId,
          userId: currentUser.uid,
          viewedAt: serverTimestamp(),
        })

        await updateDoc(doc(db, "campaigns", bannerId), {
          views: increment(1),
        })

        return
      }

      // ── Caso 2: Usuario no autenticado → fallback por dispositivo ──
      const key = `viewed_campaign_${bannerId}`
      if (localStorage.getItem(key)) return

      await updateDoc(doc(db, "campaigns", bannerId), {
        views: increment(1),
      })

      localStorage.setItem(key, "true")
    } catch (e) {
      console.error("Error tracking view:", e)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────
  // Suscripción a campañas activas
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "campaigns"),
      where("active", "==", true),
      orderBy("position", "asc")
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const now = new Date()

          const filtered = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as AdCampaign))
            .filter((banner) => {
              if (!banner.startDate || !banner.endDate) return true

              const toDate = (v: any) => (v?.toDate ? v.toDate() : new Date(v))
              const start = toDate(banner.startDate)
              const end = toDate(banner.endDate)

              if (isNaN(start.getTime()) || isNaN(end.getTime())) return true

              const endDay = new Date(end)
              endDay.setHours(23, 59, 59, 999)

              return now >= start && now <= endDay
            })

          setBanners(filtered)

          // Ajustar índice si ya no existe
          setCurrentIndex((prev) => {
            if (filtered.length === 0) return 0
            return prev >= filtered.length ? 0 : prev
          })
        } catch (error) {
          console.error("Error procesando banners:", error)
        } finally {
          setLoading(false)
        }
      },
      (error) => {
        console.error("Error de conexión Firebase:", error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // ─────────────────────────────────────────────────────────────
  // Navegación
  // ─────────────────────────────────────────────────────────────
  const nextSlide = useCallback(() => {
    if (banners.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }
  }, [banners.length])

  const prevSlide = useCallback(() => {
    if (banners.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
    }
  }, [banners.length])

  // ─────────────────────────────────────────────────────────────
  // Track click: cada clic cuenta
  // ─────────────────────────────────────────────────────────────
  const trackClick = useCallback(async (bannerId: string, link: string) => {
    try {
      await updateDoc(doc(db, "campaigns", bannerId), {
        clicks: increment(1),
      })
    } catch (error) {
      console.error("Error tracking click:", error)
    } finally {
      window.open(link, "_blank", "noopener,noreferrer")
    }
  }, [])

  // ─────────────────────────────────────────────────────────────
  // Track vista SOLO si estuvo visible 2 segundos
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!banners.length || !banners[currentIndex]) return

    const bannerId = banners[currentIndex].id

    const timer = setTimeout(() => {
      trackViewById(bannerId)
    }, 2000) // Cuenta la vista solo si estuvo visible 2 segundos

    return () => clearTimeout(timer)
  }, [currentIndex, banners, trackViewById])

  // ─────────────────────────────────────────────────────────────
  // Auto-play
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAutoPlaying || banners.length <= 1) return

    const interval = setInterval(nextSlide, 5000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, nextSlide, banners.length])

  // ─────────────────────────────────────────────────────────────
  // Estado de carga
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full py-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // Sin banners activos
  // ─────────────────────────────────────────────────────────────
  if (banners.length === 0) {
    return (
      <section className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="aspect-[3/1] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
          <ImageOff className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-sm">No hay promociones activas en este momento</p>
        </div>
      </section>
    )
  }

  return (
    <section
      className={cn(
        "relative w-full bg-card py-4 sm:py-6 transition-all duration-700",
        isLoaded && !loading ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl shadow-xl">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {banners.map((banner) => (
              <div key={banner.id} className="w-full flex-shrink-0">
                <div
                  className={cn(
                    "relative aspect-[2/1] sm:aspect-[3/1] overflow-hidden bg-muted",
                    banner.link && "cursor-pointer"
                  )}
                  onClick={() => banner.link && trackClick(banner.id, banner.link)}
                >
                  <img
                    src={banner.imageUrl || "/placeholder.svg"}
                    alt={banner.title}
                    className="h-full w-full object-cover"
                    onLoad={(e) => {
                      e.currentTarget.style.opacity = "1"
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8">
                    <h2 className="text-xl sm:text-3xl font-bold text-white mb-2">
                      {banner.title}
                    </h2>
                    <p className="text-sm sm:text-base text-white/80 line-clamp-2 max-w-xl">
                      {banner.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Flechas */}
          {banners.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-md rounded-full"
                onClick={prevSlide}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-md rounded-full"
                onClick={nextSlide}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}