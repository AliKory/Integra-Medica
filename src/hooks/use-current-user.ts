"use client"

import { useState, useEffect } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

export interface CurrentUser {
  id: string
  uid: string
  fullName: string
  phone?: string
  role: "ADMIN" | "RECEPCION" | "PACIENTE"
  avatarUrl?: string
  active?: boolean
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null)
        setLoading(false)
        return
      }

      const userRef = doc(db, "users", firebaseUser.uid)
      const unsubFirestore = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setCurrentUser({
            id:        snap.id,
            uid:       firebaseUser.uid,
            fullName:  snap.data().fullName  ?? "",
            phone:     snap.data().phone     ?? "",
            role:      snap.data().role      ?? "PACIENTE",
            avatarUrl: snap.data().avatarUrl ?? "",
            active:    snap.data().active    ?? true,
          })
        } else {
          setCurrentUser(null)
        }
        setLoading(false)
      })

      return () => unsubFirestore()
    })

    return () => unsubAuth()
  }, [])

  // ✅ Helper tipado para merge parcial — úsalo en vez de setCurrentUser
  const updateCurrentUser = (updated: Partial<CurrentUser>) => {
    setCurrentUser(prev => prev ? { ...prev, ...updated } : prev)
  }

  return { currentUser, setCurrentUser, updateCurrentUser, loading }
}