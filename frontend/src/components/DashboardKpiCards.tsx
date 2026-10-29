import type { ReactNode } from 'react';

export interface DashboardKpiItem {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  accent: string;
  onClick?: () => void;
}

/**
 * Cards de resumo do Dashboard. O tamanho acompanha a largura da tela
 * para o título e o valor em R$ ficarem dentro do card.
 */
export default function DashboardKpiCards({ items }: { items: DashboardKpiItem[] }) {
  return (
    <div className="fp-kpi-grid">
      {items.map((item) => {
        const body = (
          <>
            <div className="fp-kpi-head">
              <div
                className="fp-kpi-icon"
                style={{ background: item.iconBg, color: item.iconColor }}
              >
                {item.icon}
              </div>
              <span className="fp-kpi-label">{item.label}</span>
            </div>
            <div className="fp-kpi-value" title={item.value}>
              {item.value}
            </div>
            <div className="fp-kpi-sub">{item.sub}</div>
          </>
        );
        const className = `fp-stat-card fp-kpi-card ${item.accent}${item.onClick ? ' fp-card-interactive' : ''}`;

        if (item.onClick) {
          return (
            <button key={item.label} type="button" className={className} onClick={item.onClick}>
              {body}
            </button>
          );
        }

        return (
          <div key={item.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
