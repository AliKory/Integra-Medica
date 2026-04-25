import { Clock, Lock, Users } from "lucide-react"

interface TimeSlotsProps {
  times: string[]
  selectedTime: string | null
  bookedTimes: Set<string>
  tempBlockedTimes?: Set<string> // 🔥 NUEVO
  onSelectTime: (time: string) => void
  isEnabled: boolean
  selectedDate: Date | null
}

export function TimeSlots({ 
  times, 
  selectedTime, 
  bookedTimes, 
  tempBlockedTimes = new Set(), // 🔥 NUEVO
  onSelectTime, 
  isEnabled,
  selectedDate 
}: TimeSlotsProps) {
  
  if (!isEnabled || !selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Clock className="w-12 h-12 mb-2 opacity-20" />
        <p className="text-sm">Selecciona un día primero</p>
      </div>
    )
  }

  if (times.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Clock className="w-12 h-12 mb-2 opacity-20" />
        <p className="text-sm">No hay horarios disponibles</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
      {times.map((time) => {
        const isBooked = bookedTimes.has(time)
        const isTempBlocked = tempBlockedTimes.has(time) // 🔥 NUEVO
        const isSelected = selectedTime === time
        const isDisabled = isBooked || isTempBlocked // 🔥 ACTUALIZADO

        return (
          <button
            key={time}
            onClick={() => !isDisabled && onSelectTime(time)}
            disabled={isDisabled}
            className={`
              w-full p-3 rounded-lg border-2 transition-all duration-200 text-left flex items-center justify-between group
              ${isSelected 
                ? "border-primary bg-primary/10 shadow-md" 
                : isBooked
                  ? "border-red-200 bg-red-50 opacity-60 cursor-not-allowed"
                  : isTempBlocked // 🔥 NUEVO
                    ? "border-amber-200 bg-amber-50 opacity-70 cursor-not-allowed"
                    : "border-muted hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${isSelected ? "text-primary" : isDisabled ? "text-muted-foreground" : "text-foreground"}`} />
              <span className={`font-medium ${isSelected ? "text-primary" : isDisabled ? "text-muted-foreground" : "text-foreground"}`}>
                {time}
              </span>
            </div>
            
            {/* 🔥 ICONOS DE ESTADO */}
            {isBooked && (
              <div className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                <Lock className="w-3 h-3" />
                Ocupado
              </div>
            )}
            
            {/* 🔥 NUEVO: Indicador de bloqueo temporal */}
            {isTempBlocked && !isBooked && (
              <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded">
                <Users className="w-3 h-3" />
                Reservado
              </div>
            )}
            
            {!isDisabled && !isSelected && (
              <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Disponible
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}