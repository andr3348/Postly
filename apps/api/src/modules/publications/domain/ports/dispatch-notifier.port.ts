/**
 * Puerto para despertar al worker de despacho (n8n) cuando una publicación
 * debe salir ya. No transporta datos: el worker hace el claim normal y recibe
 * la publicación con sus credenciales.
 */
export interface DispatchNotifier {
  notify(): Promise<void>;
}

export const DISPATCH_NOTIFIER: unique symbol = Symbol('DispatchNotifier');
