import { useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { useStore } from '../../store/useStore';
import type { ChartConfig } from '../../types/report';

// ═══════════════════════════════════════════════════════════════
// SchoolMap — mapa geolocalizado de escuelas por estado del semáforo
// Proyecta el GeoJSON del partido + los puntos con d3-geo. Sin tiles
// externos: SVG autocontenido, responsive y theme-aware.
// ═══════════════════════════════════════════════════════════════

const EST_COLOR: Record<string, string> = {
  rojo: '#dc2626', amarillo: '#f59e0b', verde: '#16a34a',
};
const EST_LABEL: Record<string, string> = {
  rojo: 'Rojo (crítico)',
  amarillo: 'Amarillo (alerta)',
  verde: 'Verde (sin hallazgos críticos)',
};
const Z_ORDER = ['verde', 'amarillo', 'rojo']; // rojo dibujado arriba

interface Pt {
  lon: number; lat: number; estado: string;
  nombre?: string; localidad?: string; motivo?: string;
}

const W = 800;
const PAD = 14;

export function SchoolMap({ chart }: { chart: ChartConfig }) {
  const isDark = useStore(s => s.theme) === 'dark';
  const geojson = chart.config?.geojson as GeoJSON.Feature | undefined;
  const points = useMemo(
    () => (Array.isArray(chart.data) ? (chart.data as Pt[]) : []).filter(
      p => EST_COLOR[p.estado] && Number.isFinite(p.lon) && Number.isFinite(p.lat),
    ),
    [chart.data],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ p: Pt; x: number; y: number } | null>(null);

  const { viewBox, project } = useMemo(() => {
    if (!geojson) {
      return { viewBox: `0 0 ${W} ${W}`, project: (_c: [number, number]) => null as [number, number] | null };
    }
    const projection = geoMercator().fitWidth(W, geojson as any);
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(geojson as any);
    const vb = `${x0 - PAD} ${y0 - PAD} ${x1 - x0 + 2 * PAD} ${y1 - y0 + 2 * PAD}`;
    return { viewBox: vb, project: (c: [number, number]) => projection(c) as [number, number] | null };
  }, [geojson]);

  const boundaryPath = useMemo(
    () => (geojson ? geoPath(geoMercator().fitWidth(W, geojson as any))(geojson as any) || '' : ''),
    [geojson],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { rojo: 0, amarillo: 0, verde: 0 };
    points.forEach(p => { c[p.estado] += 1; });
    return c;
  }, [points]);

  const ordered = useMemo(
    () => [...points].sort((a, b) => Z_ORDER.indexOf(a.estado) - Z_ORDER.indexOf(b.estado)),
    [points],
  );

  if (!geojson) return null;

  return (
    <div className="school-map" ref={containerRef}>
      <svg viewBox={viewBox} className="school-map-svg" role="img"
        aria-label="Mapa de escuelas relevadas por estado del semáforo">
        <path
          d={boundaryPath}
          fill={isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,29,103,0.04)'}
          stroke={isDark ? '#4c5a80' : '#0f1d67'}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {ordered.map((p, i) => {
          const xy = project([p.lon, p.lat]);
          if (!xy) return null;
          return (
            <circle
              key={i}
              cx={xy[0]}
              cy={xy[1]}
              r={6}
              fill={EST_COLOR[p.estado]}
              stroke="#ffffff"
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              className="school-dot"
              onMouseMove={e => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setHover({ p, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="school-map-tooltip"
          style={{
            left: Math.min(hover.x + 14, (containerRef.current?.clientWidth ?? W) - 220),
            top: hover.y + 14,
          }}
        >
          <strong>{hover.p.nombre || 'Escuela'}</strong>
          <span className="school-map-tt-row">
            <span className="school-dot-legend" style={{ background: EST_COLOR[hover.p.estado] }} />
            {EST_LABEL[hover.p.estado]}
          </span>
          {hover.p.localidad && <span className="school-map-tt-muted">{hover.p.localidad}</span>}
          {hover.p.estado === 'rojo' && hover.p.motivo && (
            <span className="school-map-tt-motivo">{hover.p.motivo}</span>
          )}
        </div>
      )}

      <div className="school-map-legend">
        {(['rojo', 'amarillo', 'verde'] as const).map(e => (
          <span key={e} className="school-map-legend-item">
            <span className="school-dot-legend" style={{ background: EST_COLOR[e] }} />
            <strong>{counts[e]}</strong> {EST_LABEL[e]}
          </span>
        ))}
      </div>
    </div>
  );
}
