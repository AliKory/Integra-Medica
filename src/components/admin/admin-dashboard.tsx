"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  FlaskConical,
  Settings,
  ShieldCheck,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronRight,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { Badge } from "@/components/ui/badge"
import { CrmDashboard } from "./crm-dashboard"
import { UserManagement } from "./user-management"
import { ServiceManagement } from "./service-management"
import { LabTypesAdmin  } from "./lab-management-admin"
import { SystemSettings } from "./system-settings"
// Agrega estas importaciones al inicio
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation" // Para redirigir al login

const navItems = [
  { id: "dashboard", label: "Dashboard CRM", icon: LayoutDashboard, badge: null },
  { id: "users", label: "Usuarios", icon: Users, badge: null },
  { id: "services", label: "Servicios Medicos", icon: Stethoscope, badge: null },
  { id: "labs", label: "Laboratorios", icon: FlaskConical, badge: null },
  { id: "settings", label: "Configuracion", icon: Settings, badge: null },
] as const

type NavId = (typeof navItems)[number]["id"]

export function AdminDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<NavId>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login") // O la ruta de tu página de inicio
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <CrmDashboard />
      case "users":
        return <UserManagement />
      case "services":
        return <ServiceManagement />
      case "labs":
        return <LabTypesAdmin  />
      case "settings":
        return <SystemSettings />
      default:
        return <CrmDashboard />
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-border/40 bg-card flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-border/40 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Integra Medica</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Panel Administrador</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-primary/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Cerrar menu</span>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item, idx) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 opacity-0",
                  isLoaded && "animate-fade-in-up",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant={isActive ? "secondary" : "outline"}
                    className={cn(
                      "h-5 min-w-5 flex items-center justify-center text-[10px] px-1.5",
                      isActive && "bg-primary-foreground/20 text-primary-foreground border-transparent"
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
                {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </nav>

        {/* User card at bottom */}
<div className="border-t border-border/40 p-4">
  <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
    {/* ... avatar y textos ... */}
    <Button 
      variant="ghost" 
      size="icon" 
      className="shrink-0 h-8 w-8 hover:bg-primary/10 hover:text-primary"
      onClick={handleLogout} // <--- AÑADE ESTO
    >
      <LogOut className="h-4 w-4" />
      <span className="sr-only">Cerrar sesion</span>
    </Button>
  </div>
</div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-primary/10"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {activeTab === "dashboard" && "Metricas y analytics en tiempo real"}
                {activeTab === "users" && "Administra usuarios y roles del sistema"}
                {activeTab === "services" && "Gestiona servicios medicos y especialistas"}
                {activeTab === "labs" && "Laboratorios externos y metricas de rendimiento"}
                {activeTab === "settings" && "Configuracion general del sistema"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <UserMenu /> {/* Asegúrate de tener este componente creado */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
