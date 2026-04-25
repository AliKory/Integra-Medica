"use client"

import { useState, useEffect } from "react"
import { 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  Award, 
  Stethoscope, 
  X, 
  MessageCircle,
  ChevronLeft, 
  ArrowRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar doctores desde Firestore
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "doctors"))
        const docsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setDoctors(docsData)
      } catch (error) {
        console.error("Error cargando doctores:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDoctors()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER CONSISTENTE */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">Médicos</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Título de la página */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-3 bg-primary/5 text-primary border-primary/20">
            Equipo Médico
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            {doctors.length === 1 
              ? "Tu Especialista de Confianza" 
              : "Nuestros Especialistas"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {doctors.length === 1 
              ? "Conoce a nuestro médico experto y agenda tu cita hoy mismo."
              : "Profesionales altamente calificados comprometidos con tu salud."}
          </p>
        </div>

        {/* Grid de Doctores */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-[520px] animate-pulse">
                <div className="h-64 bg-muted rounded-t-xl" />
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-20 bg-muted rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className={cn(
            "grid gap-8",
            doctors.length === 1 
              ? "grid-cols-1 max-w-md mx-auto" 
              : doctors.length === 2 
                ? "grid-cols-1 md:grid-cols-2" 
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          )}>
            {doctors.map((doctor) => (
              <Card 
                key={doctor.id}
                className="overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group flex flex-col h-full"
              >
                {/* Imagen del Doctor */}
                <div className="relative h-64 overflow-hidden bg-muted">
                  <img 
                    src={doctor.doctorAvatar || "/placeholder-doctor.jpg"}
                    alt={doctor.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-medium shadow">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    {doctor.rating || "5.0"}
                  </div>
                </div>

                <CardHeader className="pb-3">
                  <Badge variant="secondary" className="w-fit mb-2">
                    {doctor.specialty}
                  </Badge>
                  <CardTitle className="text-2xl">{doctor.name}</CardTitle>
                  {doctor.subSpecialty && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Award className="w-4 h-4" /> {doctor.subSpecialty}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="flex-1">
                  <p className="text-muted-foreground text-[15px] leading-relaxed line-clamp-4">
                    {doctor.bio || "Especialista dedicado a brindar atención médica de excelencia con enfoque humano y profesional."}
                  </p>
                </CardContent>

                <CardFooter className="pt-2 pb-6 grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedDoctor(doctor)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Contactar
                  </Button>
                  <Button asChild>
                    <Link href="/scheduler">
                      Agendar Cita
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Modal de Contacto */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-8 relative">
            <button 
              onClick={() => setSelectedDoctor(null)}
              className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-8">
              <div className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-4 border-primary/10">
                <img 
                  src={selectedDoctor.doctorAvatar || "/placeholder-doctor.jpg"} 
                  alt={selectedDoctor.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-2xl font-bold">{selectedDoctor.name}</h3>
              <p className="text-muted-foreground">{selectedDoctor.specialty}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <Phone className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{selectedDoctor.phone || "No disponible"}</p>
                </div>
              </div>

              {selectedDoctor.email && (
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                  <Mail className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Correo</p>
                    <p className="font-medium">{selectedDoctor.email}</p>
                  </div>
                </div>
              )}

              <a 
                href={`https://wa.me/525522419394?text=Hola ${selectedDoctor.name.split(" ")[0]} me gustaría agendar una cita.`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl text-center transition-all"
              >
                Enviar mensaje por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}