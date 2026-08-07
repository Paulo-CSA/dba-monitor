import { DatabaseIntegrityOverview } from '../types/health';
import { createInitialIntegrityOverview } from '../utils/mockGenerator';

export class HealthService {
  private overview: DatabaseIntegrityOverview;

  constructor() {
    this.overview = createInitialIntegrityOverview();
  }

  public getIntegrityOverview(): DatabaseIntegrityOverview {
    return {
      ...this.overview,
      healthChecks: this.overview.healthChecks.map(hc => ({
        ...hc,
        lastChecked: new Date().toISOString()
      }))
    };
  }

  public runFullIntegrityScan(): DatabaseIntegrityOverview {
    this.overview.healthChecks = this.overview.healthChecks.map(hc => {
      if (hc.component.includes('Checksums')) {
        return {
          ...hc,
          status: 'ok',
          message: 'Scan concluído: 100% das páginas de dados íntegras (CRC32 OK).',
          lastChecked: new Date().toISOString()
        };
      }
      return { ...hc, lastChecked: new Date().toISOString() };
    });
    this.overview.overallIntegrityScore = 98;
    return this.getIntegrityOverview();
  }
}

export const healthServiceSingleton = new HealthService();
