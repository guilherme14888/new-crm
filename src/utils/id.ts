import * as Crypto from 'expo-crypto';

/** Gera um identificador único (UUID) usando o módulo de criptografia do Expo */
export function generateId(): string {
  return Crypto.randomUUID();
}
