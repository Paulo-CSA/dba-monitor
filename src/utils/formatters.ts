export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 KB';
  if (bytes < 1024) return `${bytes} Bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(decimals)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m ${secs}s`;
}

export function formatUptimeSeconds(seconds: number): string {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '0d 0h 0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export function parsePgSettingMemory(settingStr: string, unit: string | null): { bytes: number; formatted: string; megabytes: number } {
  const val = parseFloat(settingStr) || 0;
  let bytes = val;
  const unitLower = (unit || '').toLowerCase();

  if (unitLower === '8kb') {
    bytes = val * 8192;
  } else if (unitLower === 'kb') {
    bytes = val * 1024;
  } else if (unitLower === 'mb') {
    bytes = val * 1024 * 1024;
  } else if (unitLower === 'gb') {
    bytes = val * 1024 * 1024 * 1024;
  } else if (unitLower === 'tb') {
    bytes = val * 1024 * 1024 * 1024 * 1024;
  } else if (!unit) {
    // Check if string contains unit e.g. "128MB", "4GB"
    const match = settingStr.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
    if (match) {
      const num = parseFloat(match[1]) || 0;
      const u = (match[2] || '').toLowerCase();
      if (u === 'gb' || u === 'g') bytes = num * 1024 * 1024 * 1024;
      else if (u === 'mb' || u === 'm') bytes = num * 1024 * 1024;
      else if (u === 'kb' || u === 'k') bytes = num * 1024;
      else if (u === '8kb') bytes = num * 8192;
      else bytes = num;
    }
  }

  const megabytes = Math.round(bytes / (1024 * 1024));
  return {
    bytes,
    megabytes,
    formatted: formatBytes(bytes)
  };
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString || '-';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoString || '-';
  }
}

export function truncateSql(sql: string, maxLength = 120): string {
  if (sql.length <= maxLength) return sql;
  return sql.substring(0, maxLength) + '...';
}
