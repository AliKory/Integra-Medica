"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth, type AuthStep } from "@/hooks/use-auth";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { AuthSuccess } from "./auth-success";
import { Heart, ShieldCheck, Clock } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserRole } from "@/lib/auth-types";

type AuthMode = "login" | "register";

export function AuthFormWrapper() {
  const [mode, setMode] = useState<AuthMode>("login");
  const router = useRouter();
  const authHook = useAuth();

  // 1. Escuchar cuando el usuario se loguea exitosamente
  useEffect(() => {
    // Si el hook dice que tuvimos éxito, buscamos el rol para redirigir
    if (authHook.step === "success") {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Buscamos el rol en la base de datos para saber a dónde mandarlo
          const userDoc = await getDoc(doc(db, "users", user.uid));
          let role = UserRole.PACIENTE; // Rol por defecto

          if (userDoc.exists()) {
            role = userDoc.data().role;
          }

          const redirectPath = authHook.redirectByRole(role);
          
          // Esperamos 2 segundos para que vea el mensaje de éxito y redirigimos
          setTimeout(() => {
            router.push(redirectPath);
          }, 2000);
        }
      });
      return () => unsubscribe();
    }
  }, [authHook.step, authHook.redirectByRole, router]);

  const handleToggleMode = useCallback(() => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    authHook.clearError();
  }, [authHook.clearError]);

  const renderStep = () => {
    // Ya no hay caso "otp", solo formulario o éxito
    if (authHook.step === "success") {
      return <AuthSuccess user={null} mode={mode} />; // user null es visual solamente aquí
    }

    return mode === "login" ? (
      <LoginForm
        authHook={authHook}
        onToggleMode={handleToggleMode}
      />
    ) : (
      <RegisterForm
        authHook={authHook}
        onToggleMode={handleToggleMode}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Panel Izquierdo - Branding e Imagen */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-red-800/90" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
                <Heart className="w-7 h-7 text-primary-foreground" fill="currentColor" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Integra Medica
                </h1>
                <p className="text-sm text-primary-foreground/70">
                  Tu salud, nuestra prioridad
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-4xl font-bold leading-tight text-balance">
              Gestiona tu salud desde cualquier lugar
            </h2>
            <p className="text-lg text-primary-foreground/80 max-w-md leading-relaxed">
              Agenda citas, consulta resultados de laboratorio y lleva el
              control de tu expediente medico de manera segura.
            </p>

            <div className="space-y-4">
              {[
                {
                  icon: Clock,
                  title: "Agenda en segundos",
                  desc: "Reserva citas con tu especialista favorito",
                },
                {
                  icon: ShieldCheck,
                  title: "Datos protegidos",
                  desc: "Tu informacion medica siempre segura",
                },
                {
                  icon: Heart,
                  title: "Seguimiento integral",
                  desc: "Historial completo de consultas y estudios",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 p-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center shrink-0">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{feature.title}</p>
                    <p className="text-sm text-primary-foreground/70">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-primary-foreground/50">
            2026 Integra Medica. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Panel Derecho - Formulario */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">
        {/* Header Móvil */}
        <div className="lg:hidden flex items-center justify-center gap-3 pt-8 pb-4 px-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Integra Medica
            </h1>
            <p className="text-xs text-muted-foreground">
              Tu salud, nuestra prioridad
            </p>
          </div>
        </div>

        {/* Área del Formulario */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 lg:px-12">
          <div className="w-full max-w-md space-y-6 animate-fade-in-up">
            {renderStep()}
          </div>
        </div>

        {/* Footer Móvil */}
        <div className="text-center py-4 px-6 lg:hidden">
          <p className="text-xs text-muted-foreground">
            2026 Integra Medica. Todos los derechos reservados.
          </p>
        </div>
      </div>
      
      {/* Eliminamos el div de recaptcha-container porque ya no se usa */}
    </div>
  );
}