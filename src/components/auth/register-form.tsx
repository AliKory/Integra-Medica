"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormData } from "@/lib/auth-types";
import type { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  User,
  Phone,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";

interface RegisterFormProps {
  authHook: ReturnType<typeof useAuth>;
  onToggleMode: () => void;
}

export function RegisterForm({ authHook, onToggleMode }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      phone: "+52",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");

  const passwordStrength = useMemo(() => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return { checks, passed, total: 4 };
  }, [password]);

  const onSubmit = (data: RegisterFormData) => {
    authHook.registerUser(data);
  };

  return (
    <>
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-foreground">
          Crea tu cuenta
        </h2>
        <p className="text-muted-foreground mt-1">
          Registrate para acceder a todos los servicios
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
            {/* Full Name */}
            <div className="space-y-2">
              <Label
                htmlFor="register-name"
                className="text-sm font-medium text-foreground"
              >
                Nombre completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Juan Perez Lopez"
                  className={`pl-10 h-11 transition-all duration-200 ${
                    errors.fullName
                      ? "border-destructive focus-visible:ring-destructive/30"
                      : "focus-visible:ring-primary/30"
                  }`}
                  {...register("fullName")}
                  aria-invalid={!!errors.fullName}
                  aria-describedby={
                    errors.fullName ? "register-name-error" : undefined
                  }
                  autoComplete="name"
                />
              </div>
              {errors.fullName && (
                <p
                  id="register-name-error"
                  className="text-xs text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="w-3 h-3" />
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label
                htmlFor="register-phone"
                className="text-sm font-medium text-foreground"
              >
                Numero de telefono
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="register-phone"
                  type="tel"
                  placeholder="+521234567890"
                  className={`pl-10 h-11 transition-all duration-200 ${
                    errors.phone
                      ? "border-destructive focus-visible:ring-destructive/30"
                      : "focus-visible:ring-primary/30"
                  }`}
                  {...register("phone")}
                  aria-invalid={!!errors.phone}
                  aria-describedby={
                    errors.phone ? "register-phone-error" : undefined
                  }
                  autoComplete="tel"
                />
              </div>
              {errors.phone && (
                <p
                  id="register-phone-error"
                  className="text-xs text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="w-3 h-3" />
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label
                htmlFor="register-password"
                className="text-sm font-medium text-foreground"
              >
                Contrasena
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimo 8 caracteres"
                  className={`pl-10 pr-10 h-11 transition-all duration-200 ${
                    errors.password
                      ? "border-destructive focus-visible:ring-destructive/30"
                      : "focus-visible:ring-primary/30"
                  }`}
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  aria-describedby="password-strength"
                  autoComplete="new-password"
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

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div id="password-strength" className="space-y-2 animate-fade-in-up">
                  {/* Strength bar */}
                  <div className="flex gap-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={`strength-${i}`}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i < passwordStrength.passed
                            ? passwordStrength.passed <= 1
                              ? "bg-destructive"
                              : passwordStrength.passed <= 2
                                ? "bg-orange-500"
                                : passwordStrength.passed <= 3
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Requirements */}
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { key: "length" as const, label: "8+ caracteres" },
                      { key: "uppercase" as const, label: "1 mayuscula" },
                      { key: "number" as const, label: "1 numero" },
                      { key: "special" as const, label: "1 especial" },
                    ].map((req) => (
                      <div
                        key={req.key}
                        className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                          passwordStrength.checks[req.key]
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {passwordStrength.checks[req.key] ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        {req.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errors.password && (
                <p
                  className="text-xs text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label
                htmlFor="register-confirm"
                className="text-sm font-medium text-foreground"
              >
                Confirmar contrasena
              </Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="register-confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repite tu contrasena"
                  className={`pl-10 pr-10 h-11 transition-all duration-200 ${
                    errors.confirmPassword
                      ? "border-destructive focus-visible:ring-destructive/30"
                      : "focus-visible:ring-primary/30"
                  }`}
                  {...register("confirmPassword")}
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={
                    errors.confirmPassword
                      ? "register-confirm-error"
                      : undefined
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    showConfirm ? "Ocultar contrasena" : "Mostrar contrasena"
                  }
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p
                  id="register-confirm-error"
                  className="text-xs text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword.message}
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
                  Registrando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Crear cuenta
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
                Ya tienes cuenta?
              </span>
            </div>
          </div>

          {/* Toggle to Login */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2 font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:border-primary/50 hover:text-primary"
            onClick={onToggleMode}
          >
            <LogIn className="w-4 h-4" />
            Iniciar sesion
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
