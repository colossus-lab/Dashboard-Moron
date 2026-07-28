/**
 * process-infraestructura.cjs
 *
 * Informe "Estado edilicio de las escuelas — Morón" a partir del relevamiento
 * territorial de Radar-PBA. A diferencia del Censo/SNIC (agregados a nivel
 * partido), esta fuente es GEOLOCALIZADA por escuela → habilita un mapa real.
 *
 * Fuentes (snapshots commiteados en scripts/data-sources/):
 *   - moron-escuelas.csv          cue, escuela, lat, lon, estado, motivo, localidad
 *   - moron.geojson               frontera del partido (para el mapa)
 *   - semaforo-por-municipio.csv  agregados por municipio (para el ranking GBA)
 *
 * Salida: public/data/infraestructura/escuelas.json (schema ReportData).
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { GBA24, normalize, fmtInt, fmtPct, writeJson } = require('./lib/indec-utils.cjs');

const SRC = path.join(__dirname, 'data-sources');
const OUT = path.join(__dirname, '..', 'public', 'data', 'infraestructura', 'escuelas.json');

const ESTADOS = ['rojo', 'amarillo', 'verde'];
const SEMAFORO = { Rojo: '#dc2626', Amarillo: '#f59e0b', Verde: '#16a34a' };
const round1 = n => Math.round(n * 10) / 10;

function readCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
}

function main() {
  // ── Puntos por escuela ──────────────────────────────────────────────
  const rows = readCsv(path.join(SRC, 'moron-escuelas.csv'))
    .map(r => ({
      cue: r.cue,
      nombre: (r.escuela || '').trim(),
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      estado: (r.estado || '').trim(),
      motivo: (r.motivo || '').trim(),
      localidad: (r.localidad || '').trim(),
    }))
    .filter(r => ESTADOS.includes(r.estado) && Number.isFinite(r.lat) && Number.isFinite(r.lon));

  const total = rows.length;
  const by = { rojo: 0, amarillo: 0, verde: 0 };
  rows.forEach(r => { by[r.estado] += 1; });
  const pctRojo = (by.rojo / total) * 100;

  // ── Hallazgos (motivos) entre las escuelas en rojo ──────────────────
  const motivos = {};
  rows.filter(r => r.estado === 'rojo').forEach(r => {
    if (r.motivo) motivos[r.motivo] = (motivos[r.motivo] || 0) + 1;
  });
  const topMotivos = Object.entries(motivos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // ── Por localidad, apilado por estado ───────────────────────────────
  const locs = {};
  rows.forEach(r => {
    const L = r.localidad || '—';
    locs[L] = locs[L] || { rojo: 0, amarillo: 0, verde: 0 };
    locs[L][r.estado] += 1;
  });
  const locData = Object.entries(locs)
    .map(([localidad, c]) => ({
      localidad,
      Rojo: c.rojo, Amarillo: c.amarillo, Verde: c.verde,
      _tot: c.rojo + c.amarillo + c.verde,
    }))
    .sort((a, b) => b._tot - a._tot)
    .map(({ _tot, ...rest }) => rest);

  // ── Ranking: % en rojo entre los partidos del GBA relevados ─────────
  // Umbral de cobertura comparable: partidos con muy pocas escuelas relevadas
  // (2-3) dan 100% por muestra chica y ensucian la comparación. Se exige un
  // mínimo para rankear contra partidos de cobertura similar a Morón.
  const MIN_SAMPLE = 20;
  const gbaNames = new Set(GBA24.map(p => normalize(p.nombre)));
  const ranking = readCsv(path.join(SRC, 'semaforo-por-municipio.csv'))
    .map(m => ({ nombre: m.municipio, total: +m.total, rojo: +m.rojo }))
    .filter(m => gbaNames.has(normalize(m.nombre)) && m.total >= MIN_SAMPLE)
    .map(m => ({ nombre: prettyName(m.nombre), pct: round1((m.rojo / m.total) * 100), total: m.total }))
    .sort((a, b) => b.pct - a.pct);
  const moronRank = ranking.findIndex(m => normalize(m.nombre) === 'moron') + 1;

  // ── GeoJSON del partido para el mapa ────────────────────────────────
  const geojson = JSON.parse(fs.readFileSync(path.join(SRC, 'moron.geojson'), 'utf8'));

  // ── Ensamblado del ReportData ───────────────────────────────────────
  const data = {
    meta: {
      id: 'infraestructura-escuelas',
      title: 'Estado Edilicio de las Escuelas — Morón',
      category: 'Infraestructura escolar',
      subcategory: 'Semáforo edilicio · Radar-PBA',
      source: 'Radar-PBA — relevamiento territorial de escuelas (último relevamiento aprobado por escuela)',
      date: today(),
    },
    kpis: [
      { id: 'relevadas', label: 'Escuelas relevadas', value: total, formatted: fmtInt(total) },
      { id: 'rojo', label: 'En estado rojo (crítico)', value: by.rojo, formatted: fmtInt(by.rojo), unit: fmtPct(pctRojo) + ' del total', status: 'critical' },
      { id: 'amarillo', label: 'En alerta (amarillo)', value: by.amarillo, formatted: fmtInt(by.amarillo), status: 'warning' },
      { id: 'verde', label: 'Sin hallazgos críticos (verde)', value: by.verde, formatted: fmtInt(by.verde), status: 'good' },
      { id: 'rank', label: 'Puesto en el GBA por % en rojo', value: moronRank, formatted: `${moronRank}° de ${ranking.length}`, unit: `partidos del GBA con ≥${MIN_SAMPLE} escuelas relevadas` },
    ],
    charts: [
      {
        id: 'semaforo',
        type: 'pie',
        title: 'Distribución del semáforo edilicio',
        sectionId: 'panorama',
        data: [
          { id: 'Rojo', label: 'Rojo', value: by.rojo },
          { id: 'Amarillo', label: 'Amarillo', value: by.amarillo },
          { id: 'Verde', label: 'Verde', value: by.verde },
        ],
        config: { colors: SEMAFORO },
      },
      {
        id: 'mapa-escuelas',
        type: 'map',
        title: 'Cada escuela relevada, por estado del semáforo',
        sectionId: 'territorio',
        data: rows.map(r => ({
          lon: r.lon, lat: r.lat, estado: r.estado,
          nombre: r.nombre, localidad: r.localidad,
          motivo: r.estado === 'rojo' ? r.motivo : '',
        })),
        config: { geojson },
      },
      {
        id: 'hallazgos',
        type: 'bar',
        title: 'Hallazgos más frecuentes en escuelas en rojo',
        sectionId: 'hallazgos',
        data: topMotivos.map(([motivo, n]) => ({ motivo, Escuelas: n })),
        config: { xAxis: 'motivo', layout: 'horizontal', colors: { Escuelas: '#dc2626' } },
      },
      {
        id: 'localidad',
        type: 'bar',
        title: 'Escuelas por localidad y estado',
        sectionId: 'localidades',
        data: locData,
        config: { xAxis: 'localidad', stacked: true, colors: SEMAFORO },
      },
      {
        id: 'ranking-gba',
        type: 'bar',
        title: `% de escuelas en rojo — GBA (≥${MIN_SAMPLE} escuelas relevadas)`,
        sectionId: 'comparacion',
        data: ranking.map(m => ({ partido: m.nombre, 'En rojo': m.pct })),
        config: { xAxis: 'partido', layout: 'horizontal', colors: { 'Morón': '#dc2626' }, colorDefault: '#94a3b8' },
      },
    ],
    rankings: [],
    mapData: [{
      municipioId: '06568',
      municipioNombre: 'Morón',
      value: round1(pctRojo),
      formatted: fmtPct(pctRojo),
      caption: 'de las escuelas relevadas está en estado rojo (crítico)',
      footnote: `Morón · ${total} escuelas con relevamiento aprobado · Fuente: Radar-PBA (${today()})`,
      label: `${fmtPct(pctRojo)} en rojo`,
    }],
  };

  writeJson(OUT, data);
  console.log(`  · ${total} escuelas · rojo ${by.rojo} / amarillo ${by.amarillo} / verde ${by.verde} · Morón ${moronRank}°/${ranking.length} GBA`);
}

// Title-case simple para nombres de municipio que vienen en MAYÚSCULAS.
function prettyName(s) {
  const canon = GBA24.find(p => normalize(p.nombre) === normalize(s));
  if (canon) return canon.nombre;
  return s.toLowerCase().replace(/(^|\s)\p{L}/gu, m => m.toUpperCase());
}

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

main();
