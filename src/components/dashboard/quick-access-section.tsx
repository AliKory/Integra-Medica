"use client"

import { Calendar, FlaskConical, FolderOpen, Stethoscope, UploadCloud } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation";

interface QuickAccessSectionProps {
  isLoaded: boolean
}

export function QuickAccessSection({ isLoaded }: QuickAccessSectionProps) {
  const router = useRouter();

  const quickAccessItems = [
    {
      icon: Calendar,
      label: "Mis Citas",
      description: "Ver agenda",
      color: "bg-primary/10 text-primary border-primary/20",
      hoverColor: "hover:bg-primary/20 hover:border-primary/40",
      action: () => router.push("/citas"),
    },
    {
      icon: FlaskConical,
      label: "Laboratorio",
      description: "Resultados",
      color: "bg-accent/10 text-accent border-accent/20",
      hoverColor: "hover:bg-accent/20 hover:border-accent/40",
      action: () => router.push("/dashboard#lab-results-section"),
    },
    {
      icon: FolderOpen,
      label: "Expediente",
      description: "Historial",
      color: "bg-chart-3/10 text-chart-3 border-chart-3/20",
      hoverColor: "hover:bg-chart-3/20 hover:border-chart-3/40",
      action: () => router.push("/expediente"),
    },
    {
      icon: Stethoscope,
      label: "Médicos",
      description: "Directorio",
      color: "bg-chart-4/10 text-chart-4 border-chart-4/20",
      hoverColor: "hover:bg-chart-4/20 hover:border-chart-4/40",
      action: () => router.push("/medicos"),
    },
  ]

  return (
    <Card className={cn("border-border/50 shadow-sm opacity-0", isLoaded && "animate-fade-in-up animation-delay-200")}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-primary" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          Accesos Rápidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {quickAccessItems.map((item, index) => (
            <button
              key={item.label}
              onClick={item.action}
              className={cn(
                "group flex flex-col items-center gap-3 rounded-xl border p-4 sm:p-5 transition-all duration-300",
                item.color,
                item.hoverColor,
                "hover:shadow-md hover:-translate-y-1 active:scale-95",
                "opacity-0",
                isLoaded && "animate-fade-in-up",
              )}
              style={{ animationDelay: `${200 + index * 50}ms` }}
            >
              <div
                className={cn(
                  "flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110",
                  item.color,
                )}
              >
                <item.icon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground text-sm sm:text-base">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}