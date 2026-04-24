// ════════════════════════════════════════════════════════════════════
// process-seguridad.cjs
// Procesa SNIC departamental (2000-2024) y Muertes Viales (2017-2023)
// del Ministerio de Seguridad de la Nación → 2 informes del dashboard.
//
// Outputs:
//   public/data/seguridad/snic.json
//   public/data/seguridad/muertes-viales.json
// ════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const {
  SEG_BASE,
  MORON,
  GBA24,
  writeJson,
  fmtInt,
  fmtPct,
  fmtDec,
} = require('./lib/indec-utils.cjs');

const SNIC_FILE = path.join(
  SEG_BASE,
  'seguridad-snic-departamental-estadisticas-criminales-republica-argentina-por-departamentos',
  'estadísticas-criminales-en-la-república-argentina-por-departamentos-(panel)-(.csv).csv'
);
const VIALES_FILE = path.join(
  SEG_BASE,
  'seguridad-muertes-viales-sistema-alerta-temprana-estadisticas-criminales-republica-argentina',
  'hechos-y-víctimas-de-muertes-viales-en-la-república-argentina.-total-nacional-(panel)-(.csv).csv'
);
const OUT_DIR = path.join(__dirname, '..', 'public', 'data', 'seguridad');
const DATE = '2026-04-23';

// ── Parser CSV simple (sin soporte de quoted commas, pero funciona con estos datasets) ──
function* readCsvStream(file, delimiter = ';') {
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/);
  const header = lines[0].split(delimiter);
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const vals = l.split(delimiter);
    const o = {};
    header.forEach((h, k) => { o[h] = vals[k]; });
    yield o;
  }
}

function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ════════════════════════════════════════════════════════════════════
// SNIC — DELITOS 2000-2024
// ════════════════════════════════════════════════════════════════════
function processSNIC() {
  console.log('\n─── SNIC Departamental (2000-2024) ───');

  const gbaCodes = new Set(GBA24.map(p => p.codigo));
  const gbaByCode = Object.fromEntries(GBA24.map(p => [p.codigo, p.nombre]));

  // moron: por año → por delito → {hechos, victimas, masc, fem, tasa}
  const moronByYear = {};
  // gba: por partido (codigo) → por año → {hechos total}
  const gbaByPartido = {};
  for (const p of GBA24) gbaByPartido[p.codigo] = { nombre: p.nombre };

  let rowCount = 0;
  for (const r of readCsvStream(SNIC_FILE)) {
    rowCount++;
    const dep = r['departamento_id'];
    if (!dep) continue;
    const year = parseInt(r['anio'], 10);
    if (!year) continue;
    const delito = r['codigo_delito_snic_nombre'];
    const hechos = num(r['cantidad_hechos']);
    const victimas = num(r['cantidad_victimas']);
    const masc = num(r['cantidad_victimas_masc']);
    const fem = num(r['cantidad_victimas_fem']);
    const tasaHechos = num(r['tasa_hechos']);

    if (dep === MORON.codigo) {
      if (!moronByYear[year]) moronByYear[year] = { hechos: 0, victimas: 0, masc: 0, fem: 0, delitos: {} };
      moronByYear[year].hechos += hechos;
      moronByYear[year].victimas += victimas;
      moronByYear[year].masc += masc;
      moronByYear[year].fem += fem;
      moronByYear[year].delitos[delito] = (moronByYear[year].delitos[delito] || 0) + hechos;
      if (/^Homicidios dolosos$/.test(delito)) {
        moronByYear[year].homicidiosTasa = tasaHechos;
        moronByYear[year].homicidios = hechos;
      }
    }
    if (gbaCodes.has(dep)) {
      const part = gbaByPartido[dep];
      if (!part[year]) part[year] = { hechos: 0, victimas: 0, homicidios: 0 };
      part[year].hechos += hechos;
      part[year].victimas += victimas;
      if (/^Homicidios dolosos$/.test(delito)) part[year].homicidios += hechos;
      if (/^Robos \(excluye/.test(delito)) part[year].robos = (part[year].robos || 0) + hechos;
      if (/^Hurtos$/.test(delito)) part[year].hurtos = (part[year].hurtos || 0) + hechos;
    }
  }
  console.log(`  Procesadas ${rowCount} filas SNIC.`);

  // Serie temporal Morón (2000-2024)
  const years = Object.keys(moronByYear).map(Number).sort((a, b) => a - b);
  const serieHechos = years.map(y => ({ x: String(y), y: moronByYear[y].hechos }));
  const serieVictimas = years.map(y => ({ x: String(y), y: moronByYear[y].victimas }));
  const serieHomicidios = years.map(y => ({ x: String(y), y: moronByYear[y].homicidios || 0 }));

  const last = years[years.length - 1];
  const prev = last - 1;
  const hechos2024 = moronByYear[last].hechos;
  const hechosPrev = moronByYear[prev].hechos;
  const varAnual = ((hechos2024 - hechosPrev) / hechosPrev) * 100;

  const hechos2019 = moronByYear[2019]?.hechos || 1;
  const var5y = ((hechos2024 - hechos2019) / hechos2019) * 100;

  // Top delitos 2024 Morón
  const delitosUlt = moronByYear[last].delitos;
  const topDelitos = Object.entries(delitosUlt)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topDelito = topDelitos[0];

  const victimasFem2024 = moronByYear[last].fem;
  const victimasMasc2024 = moronByYear[last].masc;

  // Homicidios dolosos
  const hom2024 = moronByYear[last].homicidios || 0;
  const homPrev = moronByYear[prev].homicidios || 0;
  const homTasa = moronByYear[last].homicidiosTasa;

  // Evolución de principales delitos Morón
  const topDelitoIds = topDelitos.map(d => d[0]).slice(0, 5);
  const serieTopDelitos = topDelitoIds.map(id => ({
    id,
    data: years.map(y => ({ x: String(y), y: moronByYear[y].delitos[id] || 0 })),
  }));

  // GBA rankings: hechos 2024, tasa homicidios 2024 (aprox sin tasa exacta)
  const gbaHechos24 = GBA24.map(p => ({
    codigo: p.codigo,
    nombre: p.nombre,
    value: gbaByPartido[p.codigo][last]?.hechos || null,
  }));
  const gbaHomicidios24 = GBA24.map(p => ({
    codigo: p.codigo,
    nombre: p.nombre,
    value: gbaByPartido[p.codigo][last]?.homicidios ?? null,
  }));
  const gbaRobos24 = GBA24.map(p => ({
    codigo: p.codigo,
    nombre: p.nombre,
    value: gbaByPartido[p.codigo][last]?.robos || null,
  }));

  function rank(rows, order = 'desc') {
    return [...rows]
      .filter(r => r.value != null)
      .sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value))
      .map(r => ({ name: r.nombre, value: r.value, municipioId: r.codigo }));
  }
  function mapData(rows, labelFn) {
    return rows.filter(r => r.value != null).map(r => ({
      municipioId: r.codigo, municipioNombre: r.nombre, value: r.value, label: labelFn(r.value),
    }));
  }

  // Top delitos 2024 bar data
  const topBar = topDelitos.map(([name, value]) => ({
    delito: name.length > 40 ? name.slice(0, 37) + '…' : name,
    value,
  }));

  const data = {
    meta: {
      id: 'seguridad-snic',
      title: 'Seguridad Ciudadana — Morón (SNIC 2000-2024)',
      category: 'Seguridad',
      subcategory: 'SNIC Departamental',
      source: 'Sistema Nacional de Información Criminal (SNIC) — Ministerio de Seguridad de la Nación',
      date: DATE,
    },
    kpis: [
      {
        id: 'hechos-ult',
        label: `Hechos delictivos ${last}`,
        value: hechos2024,
        formatted: fmtInt(hechos2024),
        status: varAnual > 0 ? 'warning' : 'good',
        comparison: `${varAnual >= 0 ? '+' : ''}${fmtDec(varAnual)}% vs ${prev}`,
      },
      {
        id: 'var-5y',
        label: `Variación 5 años (${2019}→${last})`,
        value: var5y,
        formatted: `${var5y >= 0 ? '+' : ''}${fmtDec(var5y)}%`,
        status: var5y > 0 ? 'warning' : 'good',
        comparison: `${fmtInt(hechos2019)} → ${fmtInt(hechos2024)} hechos`,
      },
      {
        id: 'top-delito',
        label: 'Delito más frecuente',
        value: topDelito[1],
        formatted: fmtInt(topDelito[1]),
        comparison: topDelito[0],
      },
      {
        id: 'homicidios',
        label: `Homicidios dolosos ${last}`,
        value: hom2024,
        formatted: fmtInt(hom2024),
        status: hom2024 > homPrev ? 'critical' : 'good',
        comparison: `Tasa: ${fmtDec(homTasa, 1)} / 100K`,
      },
      {
        id: 'victimas-fem',
        label: `Víctimas mujeres ${last}`,
        value: victimasFem2024,
        formatted: fmtInt(victimasFem2024),
        comparison: `${fmtInt(victimasMasc2024)} varones • ${fmtPct(victimasFem2024 / (victimasFem2024 + victimasMasc2024) * 100)} del total`,
      },
      {
        id: 'victimas-tot',
        label: `Víctimas totales ${last}`,
        value: moronByYear[last].victimas,
        formatted: fmtInt(moronByYear[last].victimas),
      },
    ],
    charts: [
      {
        id: 'serie-hechos',
        type: 'line',
        title: 'Evolución de hechos delictivos totales — Morón (2000-2024)',
        sectionId: 'panorama',
        data: [{ id: 'Hechos', data: serieHechos }],
      },
      {
        id: 'serie-victimas',
        type: 'line',
        title: 'Víctimas registradas — Morón (2000-2024)',
        sectionId: 'panorama',
        data: [{ id: 'Víctimas', data: serieVictimas }],
      },
      {
        id: 'serie-homicidios',
        type: 'line',
        title: 'Homicidios dolosos — Morón (2000-2024)',
        sectionId: 'homicidios',
        data: [{ id: 'Homicidios', data: serieHomicidios }],
      },
      {
        id: 'top-delitos',
        type: 'bar',
        title: `Top 10 delitos en Morón — ${last}`,
        sectionId: 'delitos',
        data: topBar,
        config: { xAxis: 'delito', layout: 'horizontal' },
      },
      {
        id: 'serie-top',
        type: 'line',
        title: 'Evolución de los 5 delitos principales — Morón',
        sectionId: 'delitos',
        data: serieTopDelitos.map(s => ({
          id: s.id.length > 30 ? s.id.slice(0, 28) + '…' : s.id,
          data: s.data,
        })),
      },
      {
        id: 'gba-hechos',
        type: 'bar',
        title: `Hechos delictivos por partido — 24 GBA (${last})`,
        sectionId: 'comparacion',
        data: rank(gbaHechos24).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
      {
        id: 'gba-homicidios',
        type: 'bar',
        title: `Homicidios dolosos por partido — 24 GBA (${last})`,
        sectionId: 'comparacion',
        data: rank(gbaHomicidios24).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-hechos', title: `Hechos ${last} — 24 GBA`, sectionId: 'comparacion', items: rank(gbaHechos24), order: 'desc' },
      { id: 'rk-homicidios', title: `Homicidios dolosos ${last} — 24 GBA`, sectionId: 'comparacion', items: rank(gbaHomicidios24), order: 'desc' },
      { id: 'rk-robos', title: `Robos ${last} — 24 GBA`, sectionId: 'comparacion', items: rank(gbaRobos24), order: 'desc' },
    ],
    mapData: [{
      municipioId: '06568',
      municipioNombre: 'Morón',
      value: hechos2024,
      formatted: fmtInt(hechos2024),
      caption: `Hechos delictivos registrados en Morón — ${last}`,
      label: `${fmtInt(hechos2024)} hechos delictivos en ${last}`,
    }],
  };

  writeJson(path.join(OUT_DIR, 'snic.json'), data);
  return data.kpis;
}

// ════════════════════════════════════════════════════════════════════
// MUERTES VIALES 2017-2023
// ════════════════════════════════════════════════════════════════════
function processVialesMoron() {
  console.log('\n─── Muertes Viales (2017-2023) ───');

  const moronCodeShort = parseInt(MORON.codigoShort, 10); // 6568

  const victimas = [];
  const allRowsByPartido = {}; // para rankings GBA — conteo por codigoShort
  let total = 0;

  for (const r of readCsvStream(VIALES_FILE)) {
    total++;
    const provId = parseInt(r['provincia_id'], 10);
    const depId = parseInt(r['departamento_id'], 10);
    if (provId !== 6) continue;
    const tipo = r['tipo_persona'];
    if (tipo !== 'Víctima') continue;
    // Acumular por partido GBA
    const codigoFull = String(depId).padStart(5, '0').replace(/^0+/, '0');
    // codigoFull tipo "06568"
    const codigo5 = String(depId).padStart(5, '0'); // "06568"
    const codigo24 = '0' + codigo5.replace(/^0+/, ''); // ajustamos: "06568"
    // Mejor comparar con codigoShort
    const match = GBA24.find(p => p.codigoShort === String(depId));
    // Fallback: los códigos tienen 0 a la izquierda. Corremos sin 0:
    const gbaPartido = GBA24.find(p => String(parseInt(p.codigo, 10)) === String(depId));
    if (gbaPartido) {
      allRowsByPartido[gbaPartido.codigo] = (allRowsByPartido[gbaPartido.codigo] || 0) + 1;
    }
    if (depId !== moronCodeShort) continue;
    victimas.push({
      anio: parseInt(r['anio'], 10),
      mes: parseInt(r['mes'], 10),
      calle: r['calle_nombre'],
      inter: r['calle_interseccion_nombre'],
      tipo_lugar: r['tipo_lugar'],
      modo_prod: r['modo_produccion_hecho'],
      modo_prod_amp: r['modo_produccion_hecho_ampliada'],
      clima: r['clima_condicion'],
      sexo: r['victima_sexo'],
      edad: r['victima_tr_edad'],
      clase: r['victima_clase'],
      vehiculo: r['victima_vehiculo'],
      vehiculo_amp: r['victima_vehiculo_ampliado'],
    });
  }
  console.log(`  Procesadas ${total} filas Muertes Viales (${victimas.length} víctimas Morón).`);

  // Por año
  const porAnio = {};
  victimas.forEach(v => { porAnio[v.anio] = (porAnio[v.anio] || 0) + 1; });
  const years = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
  const serieAnual = years.map(y => ({ x: String(y), y: porAnio[y] }));
  const totalVic = victimas.length;
  const promedioAnual = totalVic / years.length;

  // Por vehículo
  const porVehiculo = {};
  victimas.forEach(v => {
    const k = v.vehiculo || 'Sin dato';
    porVehiculo[k] = (porVehiculo[k] || 0) + 1;
  });
  const vehiculosPie = Object.entries(porVehiculo)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ id: k, label: k, value: v }));
  const vehiculoTop = vehiculosPie[0];

  // Por edad
  const porEdad = {};
  victimas.forEach(v => {
    const k = v.edad || 'Sin dato';
    porEdad[k] = (porEdad[k] || 0) + 1;
  });
  const edadOrder = ['0-4','5-9','10-14','15-17','18-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+','Sin dato','Sin determinar'];
  const edadBar = edadOrder
    .filter(k => porEdad[k])
    .map(k => ({ edad: k, value: porEdad[k] }));
  // Incluir las que no entraron en edadOrder
  Object.entries(porEdad).forEach(([k, v]) => {
    if (!edadOrder.includes(k) && v > 0) edadBar.push({ edad: k, value: v });
  });

  // Por modo de producción
  const porModo = {};
  victimas.forEach(v => {
    const k = v.modo_prod || 'Sin dato';
    porModo[k] = (porModo[k] || 0) + 1;
  });
  const modoPie = Object.entries(porModo)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ id: k, label: k, value: v }));

  // Por sexo
  const porSexo = {};
  victimas.forEach(v => {
    const k = v.sexo || 'Sin dato';
    porSexo[k] = (porSexo[k] || 0) + 1;
  });

  // Calles más frecuentes
  const porCalle = {};
  victimas.forEach(v => {
    const k = (v.calle || '').trim();
    if (!k) return;
    porCalle[k] = (porCalle[k] || 0) + 1;
  });
  const callesTop = Object.entries(porCalle)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, v]) => ({ name: k, value: v }));

  // Rankings GBA
  const gbaRanking = GBA24.map(p => ({
    codigo: p.codigo,
    nombre: p.nombre,
    value: allRowsByPartido[p.codigo] || 0,
  }));
  function rank(rows) {
    return [...rows].sort((a, b) => b.value - a.value).map(r => ({ name: r.nombre, value: r.value, municipioId: r.codigo }));
  }

  const data = {
    meta: {
      id: 'seguridad-muertes-viales',
      title: 'Muertes Viales — Morón (SAT 2017-2023)',
      category: 'Seguridad',
      subcategory: 'Muertes Viales',
      source: 'Sistema de Alerta Temprana de Muertes Viales — Ministerio de Seguridad de la Nación',
      date: DATE,
    },
    kpis: [
      {
        id: 'total-victimas',
        label: 'Víctimas totales (2017-2023)',
        value: totalVic,
        formatted: fmtInt(totalVic),
        status: 'critical',
        comparison: `${years.length} años de cobertura`,
      },
      {
        id: 'promedio',
        label: 'Promedio anual',
        value: promedioAnual,
        formatted: fmtDec(promedioAnual, 1),
        unit: 'víctimas/año',
      },
      {
        id: 'vehiculo-top',
        label: 'Vehículo más afectado',
        value: vehiculoTop?.value ?? 0,
        formatted: `${vehiculoTop?.label ?? '—'}`,
        comparison: `${fmtInt(vehiculoTop?.value ?? 0)} víctimas`,
      },
      {
        id: 'calle-top',
        label: 'Calle con más víctimas',
        value: callesTop[0]?.value ?? 0,
        formatted: callesTop[0]?.name ?? '—',
        comparison: `${fmtInt(callesTop[0]?.value ?? 0)} víctimas`,
      },
    ],
    charts: [
      {
        id: 'serie-anual',
        type: 'line',
        title: 'Víctimas fatales por año — Morón',
        sectionId: 'evolucion',
        data: [{ id: 'Víctimas', data: serieAnual }],
      },
      {
        id: 'vehiculos',
        type: 'pie',
        title: 'Víctimas por tipo de vehículo',
        sectionId: 'vehiculos',
        data: vehiculosPie,
      },
      {
        id: 'edades',
        type: 'bar',
        title: 'Víctimas por grupo etario',
        sectionId: 'perfil',
        data: edadBar,
        config: { xAxis: 'edad' },
      },
      {
        id: 'modo',
        type: 'pie',
        title: 'Modo de producción del hecho',
        sectionId: 'circunstancias',
        data: modoPie,
      },
      {
        id: 'calles',
        type: 'bar',
        title: 'Top 15 calles/rutas con más víctimas — Morón',
        sectionId: 'rutas',
        data: callesTop.map(c => ({ calle: c.name, value: c.value })),
        config: { xAxis: 'calle', layout: 'horizontal' },
      },
      {
        id: 'gba-total',
        type: 'bar',
        title: 'Víctimas fatales viales — 24 GBA (2017-2023)',
        sectionId: 'comparacion',
        data: rank(gbaRanking).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-calles', title: 'Calles más críticas — Morón', sectionId: 'rutas', items: callesTop.map(c => ({ name: c.name, value: c.value })), order: 'desc' },
      { id: 'rk-gba', title: 'Víctimas fatales viales — 24 GBA', sectionId: 'comparacion', items: rank(gbaRanking), order: 'desc' },
    ],
    mapData: [{
      municipioId: '06568',
      municipioNombre: 'Morón',
      value: totalVic,
      formatted: fmtInt(totalVic),
      caption: 'Víctimas fatales en siniestros viales (2017-2023)',
      label: `${fmtInt(totalVic)} víctimas fatales (2017-2023)`,
    }],
  };

  writeJson(path.join(OUT_DIR, 'muertes-viales.json'), data);
  return data.kpis;
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Procesando SEGURIDAD — Morón                   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  processSNIC();
  processVialesMoron();
  console.log('\n✅ Done.');
}

if (require.main === module) {
  main();
}

module.exports = { main };
