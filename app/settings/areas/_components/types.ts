import type { CustomDropdownOption } from '@/components/input';

export interface AreaItem {
  id: string;
  code?: string;
  name: string;
  weatherMonitoring: boolean;
  hasPort: boolean;
  portName: string;
  coordinates?: { lat: number; lng: number };
  sortOrder?: number;
  isActive?: boolean;
}

export interface RawDbAreaRow {
  id: string;
  code?: string | null;
  name: string;
  weather_monitoring?: boolean | null;
  has_port?: boolean | null;
  port_name?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export const portFilterOptions: CustomDropdownOption[] = [
  { value: 'all', label: 'All Regions' },
  {
    value: 'with_port',
    label: 'With Port/Pier',
    dotColor: '#004AC6',
    badge: 'Maritime',
    badgeColor: 'bg-blue-50 text-[#004AC6]',
  },
  {
    value: 'no_port',
    label: 'No Port/Pier',
    dotColor: '#94A3B8',
    badge: 'Inland',
    badgeColor: 'bg-slate-100 text-[#505F76]',
  },
];

export const mapDbAreaRow = (item: RawDbAreaRow): AreaItem => ({
  id: item.id,
  code: item.code ?? undefined,
  name: item.name,
  weatherMonitoring: item.weather_monitoring ?? true,
  hasPort: item.has_port ?? false,
  portName: item.port_name || 'None',
  coordinates: item.coordinates ?? undefined,
  sortOrder: item.sort_order ?? 0,
  isActive: item.is_active ?? true,
});

export const computeAreasSignature = (areasList: AreaItem[]): string =>
  areasList
    .map(
      (a) =>
        `${a.id}:${a.code || ''}:${a.name}:${a.weatherMonitoring ? 1 : 0}:${a.hasPort ? 1 : 0}:${a.portName}:${a.sortOrder ?? 0}`
    )
    .join('|');
