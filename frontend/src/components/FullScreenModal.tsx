import React from 'react';
import { createPortal } from 'react-dom';

interface FullScreenModalProps {
  children: React.ReactNode;
}

/**
 * Renderiza um modal de tela cheia direto em document.body via Portal.
 *
 * Por quê: qualquer ancestral com `transform` (mesmo uma animação CSS que
 * termina em translateX(0)/translateY(0), como .fp-view-enter/.fp-page-slide)
 * vira um novo containing block para descendentes `position: fixed` — o
 * modal deixa de cobrir a tela toda e fica confinado dentro da área de
 * conteúdo (bug relatado: "não abre a janela completa, navego num espaço
 * estreito"). O Portal escapa dessa árvore inteira, então o modal sempre
 * cobre o viewport de verdade, não importa o que os componentes pais façam.
 */
export default function FullScreenModal({ children }: FullScreenModalProps) {
  return createPortal(children, document.body);
}
