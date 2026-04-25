"use client"

import { Check } from "lucide-react"

interface Service {
  id: string
  name: string
  icon: string
  duration: string
  price: string
}

interface ServiceSelectorProps {
  services: Service[]
  selectedService: string | null
  onSelectService: (serviceId: string) => void
  isEnabled: boolean
}

export function ServiceSelector({ services, selectedService, onSelectService, isEnabled }: ServiceSelectorProps) {
  if (!isEnabled) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 opacity-50">
        {services.map((service) => (
          <div key={service.id} className="bg-muted/50 rounded-xl p-4 text-center cursor-not-allowed">
            <span className="text-3xl mb-2 block grayscale">{service.icon}</span>
            <p className="font-medium text-sm text-muted-foreground">{service.name}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {services.map((service, index) => {
        const isSelected = selectedService === service.id
        return (
          <button
            key={service.id}
            onClick={() => onSelectService(service.id)}
            style={{ animationDelay: `${index * 75}ms` }}
            className={`
              relative p-4 rounded-xl border-2 text-center
              transition-all duration-300 ease-out
              animate-in fade-in zoom-in
              ${
                isSelected
                  ? "bg-primary/10 border-primary shadow-lg scale-[1.02]"
                  : "bg-background border-border hover:border-primary/50 hover:shadow-md"
              }
            `}
          >
            {isSelected && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md animate-in zoom-in">
                <Check className="w-4 h-4 text-primary-foreground" />
              </span>
            )}
            <span className="text-3xl mb-3 block">{service.icon}</span>
            <p className="font-semibold text-sm mb-1">{service.name}</p>
            <p className="text-xs text-muted-foreground mb-2">{service.duration}</p>
            <p className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>{service.price}</p>
          </button>
        )
      })}
    </div>
  )
}
