"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarDays,
  FlaskConical,
  Megaphone,
  ArrowLeft,
  Bell,
  User,
  LogOut // Importé el icono de salida
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation" // 🔥 Importante para redirigir
import { auth } from "@/lib/firebase" // 🔥 Importante para cerrar sesión

// ⚠️ Asegúrate de que estos archivos existan en la misma carpeta y se exporten correctamente
// Si tus componentes usan "export default", quita las llaves { } de los imports.
import { AppointmentsManagement } from "@/components/reception/appointments-management"
import { GynLabReception } from "@/components/reception/lab-management"
import { AdvertisingManagement } from "@/components/reception/advertising-management"

export default function ReceptionPanel() { 
  const [isLoaded, setIsLoaded] = useState(false)
  const router = useRouter() // Hook de navegación

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  // 🔥 Función para cerrar sesión
  const handleLogout = async () => {
    try {
      await auth.signOut()
      router.push("/login") // Redirige al login
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/80 to-primary" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex h-16 items-center justify-between">
            <div className={cn("flex items-center gap-3 opacity-0", isLoaded && "animate-fade-in-up")}>
              
              {/* Botón de volver (opcional, si es el home del recepcionista quizás no sea necesario) */}
              <Link href="/">
                <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Volver</span>
                </Button>
              </Link>
              
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-foreground">Integra Médica</h1>
                <p className="text-xs text-muted-foreground">Panel de Recepción</p>
              </div>
            </div>

            <div className={cn("flex items-center gap-2 sm:gap-4 opacity-0", isLoaded && "animate-fade-in-up animation-delay-100")}>
              
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-6">
        <Tabs defaultValue="citas" className="space-y-6">
          <TabsList className={cn(
            "grid w-full grid-cols-3 h-14 bg-muted/50 p-1.5 rounded-xl opacity-0",
            isLoaded && "animate-fade-in-up animation-delay-100"
          )}>
            <TabsTrigger
              value="citas"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25 transition-all duration-300 text-sm font-medium"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Gestión de</span> Citas
            </TabsTrigger>
            <TabsTrigger
              value="laboratorios"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25 transition-all duration-300 text-sm font-medium"
            >
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Gestión de</span> Labs
            </TabsTrigger>
            <TabsTrigger
              value="publicidad"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25 transition-all duration-300 text-sm font-medium"
            >
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">Gestión de</span> Publicidad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="citas" className="mt-6">
            <AppointmentsManagement />
          </TabsContent>

          <TabsContent value="laboratorios" className="mt-6">
            <GynLabReception  />
          </TabsContent>

          <TabsContent value="publicidad" className="mt-6">
            <AdvertisingManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}