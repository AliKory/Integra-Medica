"use client";

import { useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  UserCredential,
  User
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  type UserProfile,
  type UserRoleType,
  UserRole,
  ROLE_REDIRECTS,
  type LoginFormData,
  type RegisterFormData,
} from "@/lib/auth-types";

// Definimos el dominio "falso" para convertir teléfonos en emails
const DOMAIN_SUFFIX = "@integramedica.com";

// use-auth.ts — agrega este helper arriba del hook
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Quita el código de país 52 si viene al inicio (con o sin el +)
  return digits.startsWith("52") && digits.length > 10
    ? digits.slice(2)   // "521234567890" → "1234567890"
    : digits;           // "1234567890"   → "1234567890"
}

// Mantenemos los tipos para no romper tu UI, aunque 'otp' ya no se use
export type AuthStep = "form" | "otp" | "success";

interface UseAuthReturn {
  step: AuthStep;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  loginUser: (data: LoginFormData) => Promise<void>;
  registerUser: (data: RegisterFormData) => Promise<void>;
  adminCreateUser: (data: RegisterFormData & { role: UserRoleType }) => Promise<void>;
  clearError: () => void;
  redirectByRole: (role: UserRoleType) => string;
  reset: () => void;
}

export function useAuth(): UseAuthReturn {
  const [step, setStep] = useState<AuthStep>("form");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setStep("form");
    setIsLoading(false);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const redirectByRole = useCallback((role: UserRoleType): string => {
    return ROLE_REDIRECTS[role] || "/";
  }, []);

  // En use-auth.ts - Añade esta función al hook
  const adminCreateUser = useCallback(async (data: any) => {
  setIsLoading(true);
  setError(null);
  try {
    const cleanPhone = normalizePhone(data.phone);
    const fakeEmail = `${cleanPhone}${DOMAIN_SUFFIX}`;

    // 1. Crear en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, data.password);
    
    // 2. Guardar en Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      uid: userCredential.user.uid,
      fullName: data.fullName,
      phone: cleanPhone,
      role: data.role,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

  } catch (err: any) {
    if (err.code === "auth/email-already-in-use") {
      setError("Este número de teléfono ya está registrado en el sistema.");
      }
    throw err; 
  } finally {
    setIsLoading(false);
  }
}, []);


  // --- FUNCIÓN DE LOGIN (SIMULADA) ---
  const loginUser = useCallback(async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Convertimos teléfono a email falso
      const cleanPhone = normalizePhone(data.phone);
      const fakeEmail = `${cleanPhone}${DOMAIN_SUFFIX}`;
      
      // 2. Intentamos loguear con Firebase (Email/Pass)
      const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, data.password);
      const user = userCredential.user;

      // 3. Obtenemos sus datos de Firestore para saber el ROL
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        setSuccessMessage("Inicio de sesión exitoso. Redirigiendo...");
        setStep("success"); 
        // El componente que use este hook redirigirá al detectar 'success' o el cambio de usuario
      } else {
        // Caso raro: Existe en Auth pero no en base de datos
        setError("Error de integridad: Usuario sin perfil.");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      let msg = "Error al iniciar sesión.";
      
      // Traducimos los errores de Firebase
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        msg = "Teléfono o contraseña incorrectos.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Demasiados intentos. Espera unos minutos.";
      }
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- FUNCIÓN DE REGISTRO (SIMULADA) ---
  const registerUser = useCallback(async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Convertimos teléfono a email falso
      const cleanPhone = normalizePhone(data.phone);
      const fakeEmail = `${cleanPhone}${DOMAIN_SUFFIX}`;

      // 2. Creamos el usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, data.password);
      const user = userCredential.user;

      // 3. Actualizamos el perfil básico de Auth (Nombre visible)
      await updateProfile(user, { displayName: data.fullName });

      // 4. Guardamos los datos completos en Firestore
      const newProfile: UserProfile = {
        uid: user.uid,
        fullName: data.fullName,
        phone: cleanPhone, // Guardamos el teléfono limpio para mostrarlo
        role: UserRole.PACIENTE, // Por defecto todos son pacientes
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, "users", user.uid), {
        ...newProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessMessage("Cuenta creada exitosamente.");
      setStep("success");

    } catch (err: any) {
      console.error("Register error:", err);
      let msg = "Error al registrarse.";

      if (err.code === "auth/email-already-in-use") {
        msg = "Este número de teléfono ya está registrado.";
      } else if (err.code === "auth/weak-password") {
        msg = "La contraseña debe tener al menos 6 caracteres.";
      }

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    step,
    isLoading,
    error,
    successMessage,
    loginUser,
    registerUser,
    adminCreateUser,
    clearError,
    redirectByRole,
    reset,
  };
}