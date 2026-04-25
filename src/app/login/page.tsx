import type { Metadata } from "next";
import { AuthFormWrapper } from "@/components/auth/auth-form-wrapper";

export const metadata: Metadata = {
  title: "Iniciar Sesion - Integra Medica",
  description:
    "Accede a tu cuenta de Integra Medica para gestionar tus citas, resultados y expediente medico.",
};

export default function LoginPage() {
  return <AuthFormWrapper />;
}
