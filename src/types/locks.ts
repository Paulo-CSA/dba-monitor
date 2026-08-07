export interface StuckQuery {
  pid: number;
  usename: string;
  datname: string;
  client_addr: string;
  application_name: string;
  state: 'active' | 'idle in transaction' | 'idle in transaction (aborted)' | 'fastpath function call';
  query: string;
  durationSeconds: number;
  wait_event_type: string | null;
  wait_event: string | null;
  blocking_pid: number | null;
  isStuck: boolean;
  query_start: string;
}

export interface ActiveLock {
  locktype: string;
  relation: string;
  mode: string; // e.g. AccessExclusiveLock, RowShareLock
  granted: boolean;
  pid: number;
  usename: string;
  datname: string;
  blocking_pid: number | null;
  querySnippet: string;
  durationSeconds: number;
}

export interface LocksAndQueriesPayload {
  stuckQueries: StuckQuery[];
  activeLocks: ActiveLock[];
  totalActiveSessions: number;
  totalBlockedSessions: number;
  longestRunningDurationSec: number;
}
