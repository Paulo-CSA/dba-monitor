export interface FileLocationSetting {
  name: string;
  setting: string;
  category: 'File Locations';
  short_desc: string;
  is_writable: boolean;
  status: 'valid' | 'warning' | 'missing';
}

export interface PgSystemConfig {
  version: string;
  uptimeSeconds: number;
  serverEncoding: string;
  clientEncoding: string;
  maxConnectionsSetting: number;
  sharedBuffersSetting: string;
  workMemSetting: string;
  maintenanceWorkMemSetting: string;
  effectiveCacheSizeSetting: string;
  walLevelSetting: string;
  fileLocations: FileLocationSetting[];
}
