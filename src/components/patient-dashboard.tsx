"use client"

import { useState, useEffect } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { Loader2 } from "lucide-react"
// Asegúrate de que estas rutas sean correctas según tu estructura
import { DashboardHeader } from "./dashboard/dashboard-header"
import { BannerCarousel } from "./dashboard/banner-carousel"
import { QuickAccessSection } from "./dashboard/quick-access-section"
import { AppointmentsSection } from "./dashboard/appointments-section"
import { GynLabPatientView  } from "./dashboard/lab-results-section"
import { FloatingActions } from "./dashboard/floating-actions"
import { usePathname, useSearchParams } from "next/navigation"

export function PatientDashboard() {
  const [isLoaded, setIsLoaded] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
  if (!isLoaded) return

  const hash = window.location.hash

  if (hash === "#lab-results-section") {
    const el = document.getElementById("lab-results-section")

    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 150) // pequeño delay para asegurar render
    }
  }
}, [isLoaded])

  // Añade este useEffect en PatientDashboard (page.tsx)
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoaded(true)
      }
    })
    return () => unsubscribe()
  }, [])

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader isLoaded={isLoaded} />

      <main className="relative pb-32">
        <BannerCarousel isLoaded={isLoaded} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="space-y-6 py-6">
            <QuickAccessSection isLoaded={isLoaded} />
            <AppointmentsSection isLoaded={isLoaded} />
            
            {/* --- ESTE ES EL CAMBIO --- */}
            <div id="lab-results-section" className="scroll-mt-28">
              <GynLabPatientView />
            </div>
            {/* ------------------------- */}
            
          </div>
        </div>
      </main>

      <FloatingActions isLoaded={isLoaded} />
    </div>
  )
}