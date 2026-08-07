export async function analyzeQueryWithAI(
  query: string,
  duration: number,
  waitEvent?: string | null,
  blockingPid?: number | null
): Promise<string> {
  try {
    const res = await fetch('/api/db/ai-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, duration, waitEvent, blockingPid })
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    return data.analysis || 'Nenhuma análise foi retornada pelo servidor.';
  } catch (error) {
    console.error('Erro ao chamar IA:', error);
    return 'Não foi possível se conectar ao serviço de diagnóstico por IA.';
  }
}
