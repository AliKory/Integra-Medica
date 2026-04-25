"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/auth-types";
import type { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Phone,
  Lock,
  LogIn,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

interface LoginFormProps {
  authHook: ReturnType<typeof useAuth>;
  onToggleMode: () => void;
}

export function LoginForm({ authHook, onToggleMode }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "+52",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormData) => {
    authHook.loginUser(data);
  };

  return (
    <>
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-foreground">
          Bienvenido de vuelta
        </h2>
        <p className="text-muted-foreground mt-1">
          Ingresa tus datos para acceder a tu cuenta
        </p>
      </div>

      <Card className="border-border/50 shadow-lg shadow-primary/5">
        <CardHeader className="pb-0" />
        <CardContent className="space-y-5">
          {authHook.error && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive animate-fade-in-up"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{authHook.error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Phone field */}
            <div className="space-y-2">
              <Label
                htmlFor="login-phone"
                className="text-sm font-medium text-foreground"
              >
                Numero de telefono
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-phone"
                  type="tel"
                  placeholder="+521234567890"
                  className={`pl-10 h-11 transition-all duration-200 ${
                    errors.phone
                      ? "border-destructive focus-visible:ring-destructive/30"
                      : "focus-visible:ring-primary/30"
                  }`}
                  {...register("phone")}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "login-phone-error" : undefined}
                  autoComplete="tel"
                />
              </div>
              {errors.phone && (
                <p
                  id="login-phone-error"
                  className="text-xs text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="w-3 h-3" />
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label
                htmlFor="login-password"
                className="text-sm font-medium text-foreground"
              >
                Contrasena
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimo 8 caracteres"
                  className={`pl-10 pr-10 h-11 transition-all duration-200 ${
                    errors.password
                      ? "border-destructive focus-visible:ring-destructive/30"
                      : "focus-visible:ring-primary/30"
                  }`}
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "login-password-error" : undefined
                  }
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p
                  id="login-password-error"
                  className="text-xs text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25"
              disabled={authHook.isLoading}
            >
              {authHook.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Iniciar Sesion
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">
                No tienes cuenta?
              </span>
            </div>
          </div>

          {/* Toggle to Register */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2 font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:border-primary/50 hover:text-primary"
            onClick={onToggleMode}
          >
            <UserPlus className="w-4 h-4" />
            Crear una cuenta nueva
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
