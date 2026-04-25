"use client";

import type { UserProfile } from "@/lib/auth-types";
import { ROLE_REDIRECTS } from "@/lib/auth-types";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

interface AuthSuccessProps {
  user: UserProfile | null;
  mode: "login" | "register";
}

export function AuthSuccess({ user, mode }: AuthSuccessProps) {
  const roleName: Record<string, string> = {
    PACIENTE: "Portal del Paciente",
    RECEPCION: "Panel de Recepcion",
    ADMIN: "Panel de Administracion",
  };

  const destination = user
    ? roleName[user.role] || "Dashboard"
    : "Dashboard";

  const redirectPath = user ? ROLE_REDIRECTS[user.role] : "/";

  return (
    <div className="text-center animate-fade-in-up">
      {/* Success Icon */}
      <div className="relative mx-auto w-20 h-20 mb-6">
        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        {mode === "register"
          ? "Cuenta creada exitosamente"
          : "Inicio de sesion exitoso"}
      </h2>

      <p className="text-muted-foreground mb-6">
        {user?.fullName
          ? `Bienvenido, ${user.fullName}`
          : "Bienvenido de vuelta"}
      </p>

      <Card className="border-border/50 shadow-lg shadow-green-500/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-muted-foreground">
              Redirigiendo a{" "}
              <span className="font-semibold text-foreground">{destination}</span>
            </span>
            <ArrowRight className="w-4 h-4 text-primary" />
          </div>

          {user && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Rol: {user.role}</span>
                <span>
                  Destino:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                    {redirectPath}
                  </code>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
