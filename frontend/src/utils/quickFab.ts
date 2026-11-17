import { AppView } from '../types';

/** FAB de Acesso Rápido no Início e nas listas; oculto só no Menu. */
export function showQuickFab(view: AppView): boolean {
  return view !== AppView.MENU;
}
