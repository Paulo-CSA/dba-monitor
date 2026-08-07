import React from 'react';
import { ActiveLock } from '../types/locks';
import { Lock, ShieldAlert, ArrowRight, CheckCircle2, AlertOctagon } from 'lucide-react';

interface ActiveLocksViewProps {
  activeLocks: ActiveLock[];
}

export const ActiveLocksView: React.FC<ActiveLocksViewProps> = ({ activeLocks }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center space-x-2">
        <Lock className="w-5 h-5 text-cyan-400" />
        <div>
          <h3 className="text-base font-bold text-white">Bloqueios Ativos no Banco de Dados (`pg_locks`)</h3>
          <p className="text-xs text-slate-400">
            Locks de relação, tuplas e tabelas retidos por sessões ativas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeLocks.map((lock, idx) => {
          const isBlocking = activeLocks.some((l) => l.blocking_pid === lock.pid);

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                isBlocking
                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                  : lock.blocking_pid
                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-xs text-cyan-400">PID {lock.pid}</span>
                  <span className="text-[11px] text-slate-400">({lock.usename})</span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    lock.granted
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {lock.granted ? 'CONCEDIDO' : 'AGUARDANDO'}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Tabela/Relação:</span>
                  <span className="font-bold text-white">{lock.relation}</span>
                </div>

                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Modo de Lock:</span>
                  <span className="text-purple-300 font-semibold">{lock.mode}</span>
                </div>

                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Duração:</span>
                  <span className="text-amber-400 font-semibold">{lock.durationSeconds}s</span>
                </div>

                {lock.blocking_pid && (
                  <div className="flex items-center space-x-1.5 text-xs text-rose-300 font-semibold pt-1">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    <span>Aguardando PID {lock.blocking_pid} liberar o lock</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 truncate">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Trecho da Query:</span>
                <code>{lock.querySnippet}</code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
