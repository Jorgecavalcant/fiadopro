import { Capacitor } from '@capacitor/core';

// Detecta o app Android; na web, as opções de compra permanecem disponíveis.
export const isAndroidApp = (): boolean => Capacitor.getPlatform() === 'android';

/** Preço, botão e link de assinatura só entram na árvore do site. */
export const canShowCheckout = (): boolean => !isAndroidApp();
