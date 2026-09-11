/**
 * Robust connection string parser for DBeaver JDBC URLs, Standard URIs, and raw IP:Port inputs.
 */

export interface ParsedConnectionInfo {
  host: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
  sslMode?: 'disable' | 'auto' | 'require';
  ssl?: boolean;
  engine?: 'postgres' | 'mysql' | 'mssql';
  isPrivateOrLocal?: boolean;
  originalInput?: string;
}

/**
 * Checks if a host is a private/local network address (LAN, localhost, VPN, etc.)
 */
export function isPrivateOrLocalHost(rawHost: string): boolean {
  if (!rawHost) return false;
  const h = rawHost.trim().toLowerCase();

  // Localhost aliases
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') {
    return true;
  }

  // IPv4 Private subnets
  // 10.0.0.0 - 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) {
    return true;
  }
  // 172.16.0.0 - 172.31.255.255
  const match172 = h.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) {
    return true;
  }
  // 169.254.0.0 - 169.254.255.255 (link-local)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) {
    return true;
  }

  // Local domain extensions
  if (h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.internal') || h.endsWith('.home') || h.endsWith('.corp')) {
    return true;
  }

  return false;
}

/**
 * Parses any raw host or full connection string (including DBeaver JDBC URLs)
 */
export function parseConnectionInput(
  rawInput: string,
  defaultEngine: 'postgres' | 'mysql' | 'mssql' = 'postgres',
  defaultPort?: number
): ParsedConnectionInfo {
  let str = (rawInput || '').trim();
  const fallbackPort = defaultPort || (defaultEngine === 'mysql' ? 3306 : defaultEngine === 'mssql' ? 1433 : 5432);

  let host = '';
  let port: number = fallbackPort;
  let database: string | undefined = undefined;
  let user: string | undefined = undefined;
  let password: string | undefined = undefined;
  let sslMode: 'disable' | 'auto' | 'require' | undefined = undefined;
  let engine: 'postgres' | 'mysql' | 'mssql' = defaultEngine;

  // 1. Check DBeaver JDBC PostgreSQL: jdbc:postgresql://[user:pass@]host[:port][/database][?params]
  const jdbcPgMatch = str.match(/^jdbc:postgresql:\/\/(?:([^:]+):([^@]+)@)?([^:\/?#]+)(?::(\d+))?(?:\/([^?#]+))?(?:\?(.*))?$/i);
  if (jdbcPgMatch) {
    engine = 'postgres';
    user = jdbcPgMatch[1] || undefined;
    password = jdbcPgMatch[2] || undefined;
    host = jdbcPgMatch[3] || '';
    if (jdbcPgMatch[4]) port = Number(jdbcPgMatch[4]);
    if (jdbcPgMatch[5]) database = decodeURIComponent(jdbcPgMatch[5]);
    const query = (jdbcPgMatch[6] || '').toLowerCase();
    if (query.includes('sslmode=disable') || query.includes('ssl=false')) sslMode = 'disable';
    else if (query.includes('sslmode=require') || query.includes('ssl=true')) sslMode = 'require';

    return {
      host: host.trim(),
      port: port || 5432,
      database: database?.trim(),
      user: user?.trim(),
      password,
      sslMode,
      ssl: sslMode === 'disable' ? false : (sslMode === 'require' ? true : undefined),
      engine,
      isPrivateOrLocal: isPrivateOrLocalHost(host),
      originalInput: rawInput
    };
  }

  // 2. Check DBeaver JDBC MySQL: jdbc:mysql://[user:pass@]host[:port][/database][?params]
  const jdbcMyMatch = str.match(/^jdbc:mysql:\/\/(?:([^:]+):([^@]+)@)?([^:\/?#]+)(?::(\d+))?(?:\/([^?#]+))?(?:\?(.*))?$/i);
  if (jdbcMyMatch) {
    engine = 'mysql';
    user = jdbcMyMatch[1] || undefined;
    password = jdbcMyMatch[2] || undefined;
    host = jdbcMyMatch[3] || '';
    if (jdbcMyMatch[4]) port = Number(jdbcMyMatch[4]);
    if (jdbcMyMatch[5]) database = decodeURIComponent(jdbcMyMatch[5]);
    return {
      host: host.trim(),
      port: port || 3306,
      database: database?.trim(),
      user: user?.trim(),
      password,
      engine,
      isPrivateOrLocal: isPrivateOrLocalHost(host),
      originalInput: rawInput
    };
  }

  // 3. Check DBeaver JDBC SQL Server: jdbc:sqlserver://host[:port];databaseName=xxx;...
  const jdbcMsMatch = str.match(/^jdbc:sqlserver:\/\/([^;:\/?#]+)(?::(\d+))?(?:;(.*))?$/i);
  if (jdbcMsMatch) {
    engine = 'mssql';
    host = jdbcMsMatch[1] || '';
    if (jdbcMsMatch[2]) port = Number(jdbcMsMatch[2]);
    const props = jdbcMsMatch[3] || '';
    const dbMatch = props.match(/database(?:Name)?=([^;]+)/i);
    if (dbMatch) database = dbMatch[1];
    const userMatch = props.match(/user(?:Name)?=([^;]+)/i);
    if (userMatch) user = userMatch[1];
    const passMatch = props.match(/password=([^;]+)/i);
    if (passMatch) password = passMatch[1];
    return {
      host: host.trim(),
      port: port || 1433,
      database: database?.trim(),
      user: user?.trim(),
      password,
      engine,
      isPrivateOrLocal: isPrivateOrLocalHost(host),
      originalInput: rawInput
    };
  }

  // 4. Standard PostgreSQL URI: postgresql:// or postgres://
  const pgUriMatch = str.match(/^(?:postgresql|postgres):\/\/(?:([^:]+):([^@]+)@)?([^:\/?#]+)(?::(\d+))?(?:\/([^?#]+))?(?:\?(.*))?$/i);
  if (pgUriMatch) {
    engine = 'postgres';
    user = pgUriMatch[1] || undefined;
    password = pgUriMatch[2] || undefined;
    host = pgUriMatch[3] || '';
    if (pgUriMatch[4]) port = Number(pgUriMatch[4]);
    if (pgUriMatch[5]) database = decodeURIComponent(pgUriMatch[5]);
    const query = (pgUriMatch[6] || '').toLowerCase();
    if (query.includes('sslmode=disable') || query.includes('ssl=false')) sslMode = 'disable';
    else if (query.includes('sslmode=require') || query.includes('ssl=true')) sslMode = 'require';
    return {
      host: host.trim(),
      port: port || 5432,
      database: database?.trim(),
      user: user?.trim(),
      password,
      sslMode,
      ssl: sslMode === 'disable' ? false : (sslMode === 'require' ? true : undefined),
      engine,
      isPrivateOrLocal: isPrivateOrLocalHost(host),
      originalInput: rawInput
    };
  }

  // 5. Standard MySQL URI: mysql://
  const myUriMatch = str.match(/^mysql:\/\/(?:([^:]+):([^@]+)@)?([^:\/?#]+)(?::(\d+))?(?:\/([^?#]+))?(?:\?(.*))?$/i);
  if (myUriMatch) {
    engine = 'mysql';
    user = myUriMatch[1] || undefined;
    password = myUriMatch[2] || undefined;
    host = myUriMatch[3] || '';
    if (myUriMatch[4]) port = Number(myUriMatch[4]);
    if (myUriMatch[5]) database = decodeURIComponent(myUriMatch[5]);
    return {
      host: host.trim(),
      port: port || 3306,
      database: database?.trim(),
      user: user?.trim(),
      password,
      engine,
      isPrivateOrLocal: isPrivateOrLocalHost(host),
      originalInput: rawInput
    };
  }

  // 6. Generic cleaning: strip protocols if user typed tcp://, http://, jdbc:anything...
  let cleaned = str
    .replace(/^jdbc:[a-zA-Z0-9_-]+:\/\//i, '')
    .replace(/^[a-zA-Z0-9_-]+:\/\//i, '')
    .replace(/\/+$/, '');

  // Extract query parameters if any (e.g. host?sslmode=disable)
  if (cleaned.includes('?')) {
    const qParts = cleaned.split('?');
    cleaned = qParts[0];
    const q = (qParts[1] || '').toLowerCase();
    if (q.includes('sslmode=disable') || q.includes('ssl=false')) sslMode = 'disable';
    else if (q.includes('sslmode=require') || q.includes('ssl=true')) sslMode = 'require';
  }

  // Extract database if attached via slash (e.g. 192.168.1.50:5432/meubanco or 192.168.1.50/meubanco)
  if (cleaned.includes('/')) {
    const slashParts = cleaned.split('/');
    cleaned = slashParts[0].trim();
    if (slashParts[1] && slashParts[1].trim()) {
      database = decodeURIComponent(slashParts[1].trim());
    }
  }

  // Extract user:pass@host if attached
  if (cleaned.includes('@')) {
    const atParts = cleaned.split('@');
    const creds = atParts[0];
    cleaned = atParts[1].trim();
    if (creds.includes(':')) {
      const c = creds.split(':');
      user = c[0].trim();
      password = c[1];
    } else {
      user = creds.trim();
    }
  }

  // Extract host and port
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    host = parts[0].trim();
    const p = Number(parts[1]);
    if (p && !isNaN(p)) port = p;
  } else {
    host = cleaned.trim();
  }

  if (!host) host = '127.0.0.1';

  return {
    host,
    port: port || fallbackPort,
    database,
    user,
    password,
    sslMode,
    ssl: sslMode === 'disable' ? false : (sslMode === 'require' ? true : undefined),
    engine,
    isPrivateOrLocal: isPrivateOrLocalHost(host),
    originalInput: rawInput
  };
}
