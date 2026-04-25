import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";

export async function uploadCategoriesToFirestore() {

  const availableTimes = [
    "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM",
    "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
    "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM"
  ];

  try {
    console.log("⏳ Subiendo configuración de horarios...");

    // ✅ Crear batch correctamente
    const batch = writeBatch(db);

    // Documento destino
    const settingsRef = doc(db, "config", "availableTimes");

    // Agregar operación al batch
    batch.set(settingsRef, {
      slots: availableTimes,
      updatedAt: new Date(),
      clinicName: "Integra Médica"
    });

    // ✅ Ejecutar batch
    await batch.commit();

    console.log("✅ Horarios guardados correctamente.");
  } catch (error) {
    console.error("❌ Error al subir horarios:", error);
  }
}
