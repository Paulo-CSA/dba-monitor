import { PgSystemConfig, FileLocationSetting } from '../types/config';
import { createInitialPgConfig, createInitialFileLocations } from '../utils/mockGenerator';

export class ConfigService {
  private config: PgSystemConfig;

  constructor() {
    this.config = createInitialPgConfig();
  }

  public getSystemConfig(): PgSystemConfig {
    return { ...this.config };
  }

  public getFileLocations(): FileLocationSetting[] {
    return [...this.config.fileLocations];
  }

  public getFileLocationsSqlQuery(): string {
    return `SELECT name, setting FROM pg_settings WHERE category = 'File Locations';`;
  }
}

export const configServiceSingleton = new ConfigService();
