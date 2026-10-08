import { z } from 'zod';

/**
 * Schemas cliente de auth. Espejan los límites del backend
 * (`apps/api/.../presentation/schemas/`): validación temprana con los
 * mismos mensajes en español, sin duplicar la fuente de verdad
 * (el backend siempre revalida).
 */
export const loginSchema = z.object({
  email: z.email('Correo inválido').max(254),
  password: z.string().min(1, 'Contraseña requerida').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(100),
  email: z.email('Correo inválido').max(254),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: 'ADMIN' | 'MARKETING';
}
