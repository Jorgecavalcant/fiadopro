 import React from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react';
import { CustomerWithBalance } from '../types';
import { Translation } from '../translations';

interface ReceivablesListViewProps {
  receivables: CustomerWithBalance[];
  formatCurrency: (value: number) => string;
  navigateToCustomer: (id: string) => void;
  t: Translation;
}

const ReceivablesListView = ({
  receivables,
  formatCurrency,
  navigateToCustomer,
  t,
}: ReceivablesListViewProps) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-200 p-8 rounded-t42lg">
      <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-lg">
        <ArrowUpRight className="w-10 h-10" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-indigo-900">{t.receivablesList}</h2>
        <p className="text-indigo-700 font-medium leading-relaxed">
          Clientes com saldos pendentes a receber, ordenados pelos maiores valores.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {receivables.length === 0 ? (
        <div className="col-span-full py-20 text-center bg-white rounded-t42xl border border-slate-200">
          <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-800">Sem recebíveis pendentes</h3>
        </div>
      ) : (
        receivables.map((c: CustomerWithBalance) => (
          <div
            key={c.id}
            onClick={() => navigateToCustomer(c.id)}
            className="bg-white p-8 rounded-t42xl border border-slate-200 hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-5 mb-8">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                {c.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                  {c.name}
                </h3>
                {c.phone ? (
                  <p className="text-xs text-slate-400 font-bold">{c.phone}</p>
                ) : (
                  <p className="text-xs text-amber-600 font-bold">Telefone pendente</p>
                )}
              </div>
            </div>
            <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                  {t.pendingBalance}
                </p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(c.balance)}</p>
              </div>
              <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-2 transition-all" />
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default ReceivablesListView;