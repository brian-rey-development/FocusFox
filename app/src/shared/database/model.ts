export interface StoreConfig {
  name: string;
  keyPath: string | string[];
  indexes: Array<{ name: string; keyPath: string | string[] }>;
}
