import { ArrowDownLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay';

export type ReceivedPaymentRow = {
  id: string;
  name: string;
  phone?: string;
  totalReceived: number;
};

export function ReceivedPaymentsListView({
  rows,
  formatCurrency,
  navigateToCustomer,
}: {
  rows: ReceivedPaymentRow[];
  formatCurrency: (value: number) => string;
  navigateToCustomer: (id: string) => void;
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 p-8 rounded-t42lg">
        <div className="bg-emerald-600 p-4 rounded-3xl text-white shadow-lg">
          <ArrowDownLeft className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-emerald-900">Recebi</h2>
          <p className="text-emerald-700 font-medium leading-relaxed">
            Clientes que pagaram, com o total recebido de cada um.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rows.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-t42xl border border-slate-200">
            <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-800">Nenhum pagamento recebido ainda</h3>
          </div>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => navigateToCustomer(row.id)}
              className="bg-white p-8 rounded-t42xl border border-slate-200 hover:border-emerald-400 hover:shadow-xl transition-all cursor-pointer group text-left"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-black text-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  {row.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg group-hover:text-emerald-600 transition-colors">
                    {row.name}
                  </h3>
                  {row.phone ? (
                    <p className="text-xs text-slate-400 font-bold">{formatPhoneDisplay(row.phone)}</p>
                  ) : (
                    <p className="text-xs text-amber-600 font-bold">Telefone pendente</p>
                  )}
                </div>
              </div>
              <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                    Total recebido
                  </p>
                  <p className="text-2xl font-black text-emerald-700">{formatCurrency(row.totalReceived)}</p>
                </div>
                <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-emerald-400 group-hover:translate-x-2 transition-all" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default ReceivedPaymentsListView;
