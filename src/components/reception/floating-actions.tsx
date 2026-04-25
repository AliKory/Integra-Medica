"use client"

import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link";

interface FloatingActionsProps {
  isLoaded: boolean
}

export function FloatingActions({ isLoaded }: FloatingActionsProps) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 opacity-0",
        isLoaded && "animate-fade-in-up animation-delay-400",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Agendar citas */}
        <Link href="/scheduler-recepcion" className="flex items-center justify-center">
          <Button
            size="lg"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-all duration-300",
              "bg-primary hover:bg-primary/90 text-white",
              "hover:scale-110 active:scale-95",
              "shadow-primary/25",
            )}
          >
            <Calendar className="h-6 w-6" />
            <span className="sr-only">Agendar cita</span>
          </Button>
        </Link>
      </div>
    </div>
  )
}