import { z } from "zod";

export const UserRole = {
  PACIENTE: "PACIENTE",
  RECEPCION: "RECEPCION",
  ADMIN: "ADMIN",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export interface UserProfile {
  uid: string;
  fullName: string;
  phone: string;
  role: UserRoleType;
  createdAt: Date;
  updatedAt: Date;
}

const phoneRegex = /^\+\d{10,15}$/;

export const loginSchema = z.object({
  phone: z
    .string()
    .min(1, "El numero de telefono es obligatorio")
    .regex(phoneRegex, "Formato invalido. Usa formato internacional: +521234567890"),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres"),
});

export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre es demasiado largo"),
  phone: z
    .string()
    .min(1, "El numero de telefono es obligatorio")
    .regex(phoneRegex, "Formato invalido. Usa formato internacional: +521234567890"),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayuscula")
    .regex(/[0-9]/, "Debe contener al menos un numero"),
  confirmPassword: z.string().min(1, "Confirma tu contrasena"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contrasenas no coinciden",
  path: ["confirmPassword"],
});

export const otpSchema = z.object({
  code: z
    .string()
    .length(6, "El codigo debe tener 6 digitos")
    .regex(/^\d+$/, "Solo se permiten numeros"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type OtpFormData = z.infer<typeof otpSchema>;

export const ROLE_REDIRECTS: Record<UserRoleType, string> = {
  PACIENTE: "/",
  RECEPCION: "/recepcion",
  ADMIN: "/admin",
};
