// lib/auth-utils.ts
export const formatPhoneToEmail = (phone: string) => {
  const clean = phone.replace(/\D/g, ""); // Quita todo lo que no sea número
  return `${clean}@integramedica.com`;
};