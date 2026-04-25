"use client"
import { useState } from "react"
import { MessageCircle, Calendar, X, Plus, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import ChatBox from "@/components/chatbox/ChatBox"
import Link from "next/link";

interface FloatingActionsProps {
  isLoaded: boolean
}

export function FloatingActions({ isLoaded }: FloatingActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const phoneNumber = "+52 4482782114"

  return (
    <>
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 opacity-0",
          isLoaded && "animate-fade-in-up animation-delay-400",
        )}
      >
        {/* Secondary Actions (Phone & Chat) */}
        <div
          className={cn(
            "flex flex-col gap-3 transition-all duration-300",
            isExpanded
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none",
          )}
        >

          {/* Phone */}
          <Button
            size="lg"
            className={cn(
              "h-12 w-12 rounded-full shadow-lg transition-all duration-300",
              "bg-chart-3 hover:bg-chart-3/90 text-primary-foreground",
              "hover:scale-110 active:scale-95",
              "shadow-chart-3/25",
            )}
            onClick={() => {
              window.location.href = `tel:${phoneNumber}`
            }}
          >
            <Phone className="h-5 w-5" />
            <span className="sr-only">Llamar a la clínica</span>
          </Button>
        </div>

        {/* Main Actions Row */}
        <div className="flex items-center gap-3">
          {/* Agendar citas */}
          <Link href="/scheduler"
  className="flex items-center justify-center"
>
  <Button
    size="lg"
    className={cn(
      "h-12 w-12 rounded-full shadow-lg transition-all duration-300",
      "bg-primary hover:bg-primary/90 text-white",
      "hover:scale-110 active:scale-95",
      "shadow-primary/25",
    )}
  >
    <Calendar className="h-5 w-5" />
    <span className="sr-only">Agendar cita</span>
  </Button>
</Link>

          {/* Plus */}
          <Button
            size="lg"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "h-12 w-12 rounded-full shadow-lg transition-all duration-300",
              "bg-secondary hover:bg-secondary/90 text-secondary-foreground",
              "hover:scale-110 active:scale-95",
              "shadow-secondary/25",
            )}
          >
            {isExpanded ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            <span className="sr-only">
              {isExpanded ? "Cerrar opciones" : "Más opciones"}
            </span>
          </Button>
        </div>
      </div>

      {/* Chatbot Modal */}
      {isChatbotOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl mx-4 animate-in slide-in-from-bottom duration-300">
            <Button
              size="icon"
              variant="ghost"
              className="absolute -top-12 right-0 text-white hover:bg-white/20 z-10"
              onClick={() => setIsChatbotOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
              <ChatBox />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
