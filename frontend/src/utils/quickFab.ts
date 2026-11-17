import { AppView } from '../types';

/** O Início já tem o atalho Me deve. O botão flutuante fica nas outras listas. */
export function showQuickFab(view: AppView): boolean {
  return view !== AppView.MENU && view !== AppView.DASHBOARD;
}
