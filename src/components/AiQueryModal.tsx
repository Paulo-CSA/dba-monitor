import React from 'react';
import { Sparkles, X, Terminal, CheckCircle2, Copy } from 'lucide-react';
import { StuckQuery } from '../types/locks';

interface AiQueryModalProps {
  query: StuckQuery | null;
  analysis: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export const AiQueryModal: React.FC<AiQueryModalProps> = ({
  query,
  analysis,
  isLoading,
  onClose
}) => {
  if (!query) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Diagnóstico e Otimização Gemini IA</h2>
              <p className="text-xs text-slate-400">Análise de causa raiz e sugestão de índices B-Tree / tuning de SQL</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Target Query Code Box */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono">
            <span className="text-[10px] text-slate-500 uppercase block mb-1 font-sans">Query Sob Análise (PID {query.pid}):</span>
            <code className="text-cyan-300 block overflow-x-auto whitespace-pre-wrap">{query.query}</code>
          </div>

          {/* AI Output Content */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <Sparkles className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">Analisando padrão de execução e locks de tabela com Gemini IA...</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap font-sans">
                {analysis}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
