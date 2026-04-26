import { Suspense } from "react"
import { PatientDashboard } from "@/components/patient-dashboard"

export default function Page() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <PatientDashboard />
    </Suspense>
  )
}