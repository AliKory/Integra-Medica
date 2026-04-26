import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { fullName, phone, password, role } = await request.json();

    // Validaciones
    if (!fullName || !phone || !password || !role) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    if (phone.length !== 10) {
      return NextResponse.json(
        { error: "El teléfono debe tener 10 dígitos" },
        { status: 400 }
      );
    }

    // Generar email único (mismo método que en register-form)
    const email = `${phone}@clinica.local`;

    try {
      // 1. Crear usuario en Firebase Authentication
      const userRecord = await adminAuth.createUser({
        email: email,
        password: password,
        displayName: fullName,
        phoneNumber: `+52${phone}`,
      });

      // 2. Crear documento en Firestore
      const userData = {
        uid: userRecord.uid,
        fullName: fullName,
        phone: `+52${phone}`,
        role: role,
        active: true,
        email: email,
        createdAt: new Date(),
      };

      await adminDb.collection("users").doc(userRecord.uid).set(userData);

      return NextResponse.json({
        success: true,
        message: "Usuario creado exitosamente",
        user: userData,
      });
    } catch (authError: any) {
      console.error("Error en Auth:", authError);
      
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: "Ya existe un usuario con este número de teléfono" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: authError.message || "Error al crear usuario" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}