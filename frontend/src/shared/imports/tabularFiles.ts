export type TabularFormat = 'csv' | 'xlsx';

export function buildTabularFileUrl(basePath: string, format: TabularFormat) {
  return `${basePath}?format=${format}`;
}
