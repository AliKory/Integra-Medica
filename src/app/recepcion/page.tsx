"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase" // Asegúrate de tus imports
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Loader2 } from "lucide-react"

// Importamos tu componente visual principal
import ReceptionPanel from "@/components/reception/reception-panel"

export default function ReceptionPage() {
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Si no hay usuario, fuera de aquí
        router.push("/login")
        return
      }

      // Verificamos el rol en la base de datos
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid)) // O "receptionists" según tu BD
        
        if (userDoc.exists()) {
          const userData = userDoc.data()
          
          // AQUÍ VALIDAMOS EL ROL
          // Asegúrate que en tu BD el campo se llame 'role' y el valor sea 'reception' o 'RECEPCION'
          if (userData.role === "reception" || userData.role === "RECEPCION") {
            setIsAuthorized(true)
          } else {
            // Si es usuario normal o admin intentando entrar aquí, lo mandamos a su sitio
            router.push("/") 
          }
        } else {
            router.push("/login")
        }
      } catch (error) {
        console.error("Error verificando rol:", error)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthorized) {
    return null // O una pantalla de "Acceso Denegado"
  }

  // Si pasa todas las validaciones, mostramos el componente que ya tienes
  return <ReceptionPanel />
}