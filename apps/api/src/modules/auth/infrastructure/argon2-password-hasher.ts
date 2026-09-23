import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';

/**
 * Adaptador argon2id de `PasswordHasher`.
 * argon2id = recomendación OWASP (memory-hard, resistente a GPU/ASIC).
 * Parámetros explícitos para que queden documentados en la tesis.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainPassword);
    } catch {
      // Hash malformado o algoritmo desconocido: credencial inválida,
      // nunca una excepción 500 hacia el cliente.
      return false;
    }
  }
}
