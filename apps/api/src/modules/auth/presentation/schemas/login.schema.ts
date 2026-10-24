import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Correo inválido').max(254),
  password: z.string().min(1, 'Contraseña requerida').max(128),
  // Cookie persistente (7 días) vs cookie de sesión. Default: no persistente.
  rememberMe: z.boolean().optional().default(false),
});

export type LoginDto = z.infer<typeof loginSchema>;
