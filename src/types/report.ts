// ═══════════════════════════════════════════════════════════════
// ReportData — Schema for data.json files
// ═══════════════════════════════════════════════════════════════

export interface ReportMeta {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  source: string;
  date: string;
}

export interface KPI {
  id: string;
  label: string;
  value: number;
  formatted: string;
  unit?: string;
  status?: 'good' | 'warning' | 'critical';
  comparison?: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'pyramid' | 'scatter' | 'radar' | 'treemap' | 'heatmap' | 'map';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  sectionId: string;
  data: any[];
  config?: {
    xAxis?: string;
    yAxis?: string;
    colorScheme?: string;
    stacked?: boolean;
    grouped?: boolean;
    layout?: 'horizontal' | 'vertical';
    /** Colores por-dato: mapea id de serie o valor del eje a un color.
     *  Activa la paleta semáforo en pie/bar sin tocar el resto de los charts. */
    colors?: Record<string, string>;
    /** Color de relleno para las barras/arcos sin match en `colors`. */
    colorDefault?: string;
    /** GeoJSON del partido para el chart `type: 'map'` (frontera del mapa). */
    geojson?: unknown;
  };
}

export interface RankingConfig {
  id: string;
  title: string;
  sectionId: string;
  items: Array<{
    name: string;
    value: number;
    municipioId?: string;
  }>;
  order: 'asc' | 'desc';
}

export interface MapDataItem {
  municipioId: string;
  municipioNombre: string;
  value: number;
  /** Número ya formateado para mostrar en el hero ("331.183", "80,8%") */
  formatted?: string;
  /** Caption que explica qué representa el número (overline) */
  caption?: string;
  /** Nota al pie del bloque hero. Si se omite, ReportView usa el texto por
   *  defecto del Censo ("no se publica desagregado por barrio"). Los informes
   *  con datos geolocalizados (ej. Radar-PBA) pasan su propia nota. */
  footnote?: string;
  /** Legacy: texto humano combinado para tooltips */
  label: string;
}

export interface ReportData {
  meta: ReportMeta;
  kpis: KPI[];
  charts: ChartConfig[];
  rankings: RankingConfig[];
  mapData: MapDataItem[];
}

// ═══════════════════════════════════════════════════════════════
// Report Registry Entry
// ═══════════════════════════════════════════════════════════════

export interface ReportEntry {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  subcategory?: string;
  icon: string;
  color: string;
  mdPath: string;      // path to .md in public/reports/
  dataPath: string;    // path to data.json in public/data/
  order: number;
}
