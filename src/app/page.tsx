"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { PatientDashboard } from "@/components/patient-dashboard"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading")
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setStatus("authenticated")
      } else {
        setStatus("unauthenticated")
        router.push("/login")
      }
    })
    return () => unsubscribe()
  }, [router])

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground animate-pulse">Iniciando Integra Médica...</p>
        </div>
      </div>
    )
  }

  if (status === "authenticated") {
    return <PatientDashboard />
  }

  return null // Mientras redirige al login
}