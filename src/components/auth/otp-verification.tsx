"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { otpSchema, type OtpFormData, type UserProfile } from "@/lib/auth-types";
import type { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ShieldCheck,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

interface OtpVerificationProps {
  authHook: ReturnType<typeof useAuth>;
  onVerified: (user: UserProfile) => void;
  onBack: () => void;
}

export function OtpVerification({
  authHook,
  onVerified,
  onBack,
}: OtpVerificationProps) {
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));

  const {
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    setCanResend(true);
  }, [countdown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;

      const newDigits = [...digits];
      newDigits[index] = value;
      setDigits(newDigits);
      setValue("code", newDigits.join(""), { shouldValidate: true });

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, setValue]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);
      if (pasted.length > 0) {
        const newDigits = Array(6).fill("");
        for (let i = 0; i < pasted.length; i++) {
          newDigits[i] = pasted[i];
        }
        setDigits(newDigits);
        setValue("code", newDigits.join(""), { shouldValidate: true });
        const focusIndex = Math.min(pasted.length, 5);
        inputRefs.current[focusIndex]?.focus();
      }
    },
    [setValue]
  );

  const onSubmit = async (data: OtpFormData) => {
    const user = await authHook.verifyOtp(data.code);
    if (user) {
      onVerified(user);
    }
  };

  const handleResend = () => {
    setCountdown(60);
    setCanResend(false);
    setDigits(Array(6).fill(""));
    setValue("code", "");
    // Re-trigger OTP send via the stored phone
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Verifica tu telefono
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
          Ingresa el codigo de 6 digitos que enviamos por SMS a tu numero de
          telefono
        </p>
      </div>

      <Card className="border-border/50 shadow-lg shadow-primary/5">
        <CardHeader className="pb-0" />
        <CardContent className="space-y-6">
          {authHook.error && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive animate-fade-in-up"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{authHook.error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* OTP Input Grid */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground sr-only">
                Codigo de verificacion
              </Label>
              <div
                className="flex justify-center gap-2 sm:gap-3"
                onPaste={handlePaste}
                role="group"
                aria-label="Codigo de verificacion de 6 digitos"
              >
                {digits.map((digit, index) => (
                  <Input
                    key={`otp-${index}`}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`w-11 h-13 sm:w-13 sm:h-14 text-center text-xl font-bold transition-all duration-200 ${
                      digit
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : errors.code
                          ? "border-destructive"
                          : ""
                    } focus-visible:ring-primary/30 focus-visible:border-primary`}
                    aria-label={`Digito ${index + 1}`}
                  />
                ))}
              </div>
              {errors.code && (
                <p
                  className="text-xs text-destructive text-center flex items-center justify-center gap-1 mt-2"
                  role="alert"
                >
                  <AlertCircle className="w-3 h-3" />
                  {errors.code.message}
                </p>
              )}
            </div>

            {/* Countdown / Resend */}
            <div className="text-center">
              {canResend ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  className="gap-2 text-primary hover:text-primary/80 hover:bg-primary/5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reenviar codigo
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Reenviar codigo en{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatCountdown(countdown)}
                  </span>
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25"
              disabled={
                authHook.isLoading || digits.join("").length < 6
              }
            >
              {authHook.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Verificar codigo
                </>
              )}
            </Button>
          </form>

          {/* Back */}
          <Button
            type="button"
            variant="ghost"
            className="w-full gap-2 text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al formulario
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
