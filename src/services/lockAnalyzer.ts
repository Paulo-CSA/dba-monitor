import { StuckQuery, ActiveLock, LocksAndQueriesPayload } from '../types/locks';
import { createInitialStuckQueries, createInitialActiveLocks } from '../utils/mockGenerator';

export class LockAnalyzer {
  private stuckQueries: StuckQuery[];
  private activeLocks: ActiveLock[];

  constructor() {
    this.stuckQueries = createInitialStuckQueries();
    this.activeLocks = createInitialActiveLocks();
  }

  public getLocksAndQueries(): LocksAndQueriesPayload {
    const totalActive = this.stuckQueries.length + 12;
    const totalBlocked = this.stuckQueries.filter(q => q.blocking_pid !== null).length;
    const maxDur = this.stuckQueries.reduce((acc, q) => Math.max(acc, q.durationSeconds), 0);

    return {
      stuckQueries: [...this.stuckQueries],
      activeLocks: [...this.activeLocks],
      totalActiveSessions: totalActive,
      totalBlockedSessions: totalBlocked,
      longestRunningDurationSec: maxDur
    };
  }

  public killBackendPid(pid: number): { success: boolean; message: string } {
    const exists = this.stuckQueries.some(q => q.pid === pid);
    if (!exists) {
      return { success: false, message: `PID ${pid} não foi encontrado ou já foi finalizado.` };
    }

    // Remove stuck query
    this.stuckQueries = this.stuckQueries.filter(q => q.pid !== pid);
    this.activeLocks = this.activeLocks.filter(l => l.pid !== pid);

    // Unblock any query that was waiting on this PID
    this.stuckQueries = this.stuckQueries.map(q => {
      if (q.blocking_pid === pid) {
        return {
          ...q,
          blocking_pid: null,
          wait_event: null,
          wait_event_type: null
        };
      }
      return q;
    });

    return {
      success: true,
      message: `Comando SELECT pg_terminate_backend(${pid}) executado com sucesso. Sessão terminada.`
    };
  }

  public addSimulatedStuckQuery(newQuery: StuckQuery): void {
    this.stuckQueries.push(newQuery);
  }
}

export const lockAnalyzerSingleton = new LockAnalyzer();
