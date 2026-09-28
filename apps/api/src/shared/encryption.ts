import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Recomendado para GCM
const AUTH_TAG_LENGTH = 16;

export function encrypt(text: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('Invalid encryption key length, must be 32 bytes (64 hex characters)');
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
