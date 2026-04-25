"use client"

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CustomCalendarProps {
  currentMonth: Date
  selectedDay: Date | null
  onSelectDay: (day: Date) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

export function CustomCalendar({
  currentMonth,
  selectedDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: CustomCalendarProps) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const today = startOfDay(new Date())

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  return (
    <div className="select-none">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevMonth}
          className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors bg-transparent"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-xl font-bold capitalize">{format(currentMonth, "MMMM yyyy", { locale: es })}</h3>
        <Button
          variant="outline"
          size="icon"
          onClick={onNextMonth}
          className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors bg-transparent"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          const isTodayDate = isToday(day)
          const isPast = isBefore(day, today)
          const isDisabled = !isCurrentMonth || isPast

          return (
            <button
              key={idx}
              onClick={() => !isDisabled && onSelectDay(day)}
              disabled={isDisabled}
              className={`
                relative aspect-square flex items-center justify-center rounded-xl text-sm font-medium
                transition-all duration-200 ease-out
                ${isDisabled ? "text-muted-foreground/40 cursor-not-allowed" : "hover:bg-primary/10 cursor-pointer"}
                ${isSelected ? "bg-primary text-primary-foreground shadow-lg scale-105 hover:bg-primary" : ""}
                ${isTodayDate && !isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
                ${!isCurrentMonth ? "opacity-30" : ""}
              `}
            >
              <span className="relative z-10">{format(day, "d")}</span>
              {isTodayDate && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-full ring-2 ring-primary ring-offset-2" />
          <span>Hoy</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-full bg-primary" />
          <span>Seleccionado</span>
        </div>
      </div>
    </div>
  )
}
