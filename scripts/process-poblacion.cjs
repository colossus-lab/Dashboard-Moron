// ════════════════════════════════════════════════════════════════════
// process-poblacion.cjs
// Genera los 7 informes de Población del Dashboard Morón a partir de
// los cuadros del Censo 2022 publicados por INDEC.
//
// Outputs:
//   public/data/poblacion/estructura.json
//   public/data/poblacion/viviendas.json
//   public/data/poblacion/hogares.json
//   public/data/poblacion/habitacional-personas.json
//   public/data/poblacion/salud.json
//   public/data/poblacion/prevision.json
// ════════════════════════════════════════════════════════════════════

const path = require('path');
const XLSX = require('xlsx');
const {
  INDEC_BASE,
  MORON,
  GBA24,
  normalize,
  toNumber,
  readSheetMatrix,
  findPartidoRow,
  buildPartidoSheetIndex,
  findTotalRow,
  writeJson,
  fmtInt,
  fmtPct,
  fmtDec,
  buildFeatured,
} = require('./lib/indec-utils.cjs');

const CENSO_DIR = path.join(INDEC_BASE, 'poblacion', 'censo_2022');
const OUT_DIR = path.join(__dirname, '..', 'public', 'data', 'poblacion');
const SOURCE = 'INDEC — Censo Nacional de Población, Hogares y Viviendas 2022';
const DATE = '2026-04-23';

// ── Helpers ─────────────────────────────────────────────────────────
function loadCuadro(file, sheetHint) {
  const full = path.join(CENSO_DIR, file);
  const matrix = readSheetMatrix(full, sheetHint);
  return matrix;
}

function extractAllPartidosCol(matrix, colIndex) {
  // Para los 24 del GBA (+ todas las filas detectadas por código)
  const out = [];
  for (const p of GBA24) {
    const row = findPartidoRow(matrix, p.codigo, p.nombre);
    const v = row ? toNumber(row[colIndex]) : null;
    out.push({ codigo: p.codigo, nombre: p.nombre, value: v });
  }
  return out;
}

// (buildFeatured vive en ./lib/indec-utils.cjs — emite el KPI destacado
// que el ReportView renderiza como bloque "hero" en lugar de mapa.)

function rankGBA(rows, order = 'desc') {
  return [...rows]
    .filter(r => r.value != null)
    .sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value))
    .map(r => ({
      name: r.nombre,
      value: r.value,
      municipioId: r.codigo,
    }));
}

// ════════════════════════════════════════════════════════════════════
// 1. ESTRUCTURA POBLACIONAL
// ════════════════════════════════════════════════════════════════════
function processEstructura() {
  console.log('\n─── Estructura ───');

  // est_c1: Total población 2010 y 2022 + variación
  const c1 = loadCuadro('c2022_bsas_est_c1_2.xlsx', 'Cuadro1.2');
  const moronRow1 = findPartidoRow(c1, MORON.codigo, MORON.nombre);
  const pob2010 = toNumber(moronRow1[2]);
  const pob2022 = toNumber(moronRow1[3]);
  const varAbs = toNumber(moronRow1[4]);
  const varRel = toNumber(moronRow1[5]);

  // est_c2: Superficie + densidad
  const c2 = loadCuadro('c2022_bsas_est_c2_2.xlsx', 'Cuadro2.2');
  const moronRow2 = findPartidoRow(c2, MORON.codigo, MORON.nombre);
  const superficie = toNumber(moronRow2[2]);
  const densidad = toNumber(moronRow2[4]);

  // est_c6: Edad mediana
  const c6 = loadCuadro('c2022_bsas_est_c6_2.xlsx', 'Cuadro 6.2');
  const moronRow6 = findPartidoRow(c6, MORON.codigo, MORON.nombre);
  const edadMediana = toNumber(moronRow6[2]);
  const edadMedianaMuj = toNumber(moronRow6[3]);
  const edadMedianaVar = toNumber(moronRow6[4]);

  // est_c7: % 65+ (historical 1970-2022, column indices: 2..7)
  const c7 = loadCuadro('c2022_bsas_est_c7_2.xlsx', 'Cuadro 7.2');
  const moronRow7 = findPartidoRow(c7, MORON.codigo, MORON.nombre);
  const serie65 = ['1970', '1980', '1991', '2001', '2010', '2022'].map((year, i) => ({
    year,
    value: toNumber(moronRow7[2 + i]),
  })).filter(d => d.value != null);
  const pct65 = serie65[serie65.length - 1]?.value;

  // est_c8: Índice envejecimiento
  const c8 = loadCuadro('c2022_bsas_est_c8_2.xlsx', 'Cuadro 8.2');
  const moronRow8 = findPartidoRow(c8, MORON.codigo, MORON.nombre);
  const serieEnv = ['1970', '1980', '1991', '2001', '2010', '2022'].map((year, i) => ({
    year,
    value: toNumber(moronRow8[2 + i]),
  })).filter(d => d.value != null);
  const envIndex = serieEnv[serieEnv.length - 1]?.value;

  // est_c9: Dependencia
  const c9 = loadCuadro('c2022_bsas_est_c9_2.xlsx', 'Cuadro 9.2');
  const moronRow9 = findPartidoRow(c9, MORON.codigo, MORON.nombre);
  const serieDep = ['1970', '1980', '1991', '2001', '2010', '2022'].map((year, i) => ({
    year,
    value: toNumber(moronRow9[2 + i]),
  })).filter(d => d.value != null);

  // est_c5: pirámide por edad (hoja específica de Morón: 87)
  // Estructura: [Edad, Total, VivP, VivC]
  let piramide = [];
  try {
    const c5 = loadCuadro('c2022_bsas_est_c5_2.xlsx', 'Cuadro5.2.87');
    for (const r of c5) {
      if (!r || !r[0]) continue;
      const label = String(r[0]).trim();
      // Solo quinquenales (ej: "0-4", "5-9", ... "95-99", "100 y más")
      if (/^\d+[-\u2013]\d+$/.test(label) || /100\s*y\s*m[aá]s/i.test(label)) {
        const tot = toNumber(r[1]);
        if (tot != null) piramide.push({ grupo: label, total: tot });
      }
    }
  } catch (e) {
    console.warn('  ⚠ No se pudo leer pirámide:', e.message);
  }

  // est_c4: Sexo por edad (hoja 87)
  let piramideSexo = [];
  try {
    const c4 = loadCuadro('c2022_bsas_est_c4_2.xlsx', 'Cuadro4.2.87');
    for (const r of c4) {
      if (!r || !r[0]) continue;
      const label = String(r[0]).trim();
      if (/^\d+[-\u2013]\d+$/.test(label) || /100\s*y\s*m[aá]s/i.test(label)) {
        const muj = toNumber(r[2]);
        const var_ = toNumber(r[3]);
        if (muj != null && var_ != null) {
          piramideSexo.push({ grupo: label, mujeres: muj, varones: var_ });
        }
      }
    }
  } catch (e) {
    console.warn('  ⚠ No se pudo leer pirámide sexo:', e.message);
  }

  // Rankings GBA24: población, densidad, % 65+
  const gbaPob = extractAllPartidosCol(c1, 3);
  const gbaDens = extractAllPartidosCol(c2, 4);
  const gbaPct65 = extractAllPartidosCol(c7, 7); // columna 2022
  const gbaEdadMediana = extractAllPartidosCol(c6, 2);

  // Cálculos contextuales
  const gbaPobValues = gbaPob.filter(p => p.value != null).map(p => p.value);
  const totalGBA = gbaPobValues.reduce((a, b) => a + b, 0);
  const shareGBA = pob2022 / totalGBA;
  const rankingPob = rankGBA(gbaPob).findIndex(r => r.municipioId === MORON.codigo) + 1;
  const rankingDens = rankGBA(gbaDens).findIndex(r => r.municipioId === MORON.codigo) + 1;

  const data = {
    meta: {
      id: 'poblacion-estructura',
      title: 'Estructura por Sexo y Edad — Morón',
      category: 'Población',
      subcategory: 'Estructura',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      {
        id: 'poblacion-total',
        label: 'Población 2022',
        value: pob2022,
        formatted: fmtInt(pob2022),
        unit: 'hab',
        status: 'good',
        comparison: `${fmtPct(shareGBA * 100)} de los 24 GBA`,
      },
      {
        id: 'variacion',
        label: 'Variación 2010-2022',
        value: varRel,
        formatted: `+${fmtDec(varRel)}%`,
        status: varRel >= 5 ? 'good' : 'warning',
        comparison: `+${fmtInt(varAbs)} habitantes`,
      },
      {
        id: 'densidad',
        label: 'Densidad',
        value: densidad,
        formatted: fmtInt(densidad),
        unit: 'hab/km²',
        status: 'warning',
        comparison: `Ranking ${rankingDens}° en el GBA`,
      },
      {
        id: 'edad-mediana',
        label: 'Edad mediana',
        value: edadMediana,
        formatted: String(edadMediana),
        unit: 'años',
        comparison: `Mujeres: ${edadMedianaMuj} • Varones: ${edadMedianaVar}`,
      },
      {
        id: 'pct65',
        label: 'Población 65+',
        value: pct65,
        formatted: fmtPct(pct65),
        status: pct65 > 14 ? 'warning' : 'good',
        comparison: `Índice envejecimiento: ${envIndex}`,
      },
      {
        id: 'superficie',
        label: 'Superficie',
        value: superficie,
        formatted: fmtInt(superficie),
        unit: 'km²',
      },
    ],
    charts: [
      piramideSexo.length > 0 && {
        id: 'piramide',
        type: 'bar',
        title: 'Pirámide poblacional por sexo — Morón 2022',
        sectionId: 'piramide',
        data: piramideSexo.map(p => ({
          grupo: p.grupo,
          Mujeres: p.mujeres,
          Varones: -p.varones,
        })),
        config: { xAxis: 'grupo', layout: 'horizontal' },
      },
      {
        id: 'serie-65',
        type: 'line',
        title: '% de población 65 y más — Morón (1970-2022)',
        sectionId: 'envejecimiento',
        data: [{ id: 'Morón', data: serie65.map(d => ({ x: d.year, y: d.value })) }],
      },
      {
        id: 'serie-env',
        type: 'line',
        title: 'Índice de envejecimiento — Morón (1970-2022)',
        sectionId: 'envejecimiento',
        data: [{ id: 'Morón', data: serieEnv.map(d => ({ x: d.year, y: d.value })) }],
      },
      {
        id: 'pob-gba',
        type: 'bar',
        title: 'Población por partido — 24 partidos del GBA (2022)',
        sectionId: 'comparacion',
        data: rankGBA(gbaPob).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
      {
        id: 'densidad-gba',
        type: 'bar',
        title: 'Densidad poblacional — 24 partidos del GBA (hab/km²)',
        sectionId: 'comparacion',
        data: rankGBA(gbaDens).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ].filter(Boolean),
    rankings: [
      {
        id: 'ranking-pob',
        title: 'Población total — 24 partidos GBA',
        sectionId: 'comparacion',
        items: rankGBA(gbaPob),
        order: 'desc',
      },
      {
        id: 'ranking-densidad',
        title: 'Densidad (hab/km²) — 24 partidos GBA',
        sectionId: 'comparacion',
        items: rankGBA(gbaDens),
        order: 'desc',
      },
      {
        id: 'ranking-65',
        title: '% de población 65 años y más — 24 partidos GBA',
        sectionId: 'envejecimiento',
        items: rankGBA(gbaPct65),
        order: 'desc',
      },
    ],
    mapData: buildFeatured(pob2022, fmtInt(pob2022), 'Habitantes en Morón (Censo 2022)'),
  };

  writeJson(path.join(OUT_DIR, 'estructura.json'), data);
  return { pob2022, varRel, superficie, densidad, edadMediana, pct65, envIndex, rankingPob };
}

// ════════════════════════════════════════════════════════════════════
// 2. VIVIENDAS
// ════════════════════════════════════════════════════════════════════
function processViviendas() {
  console.log('\n─── Viviendas ───');

  // vivienda_c1: condición ocupación
  // cols: 0 cod, 1 partido, 2 total, 3 particulares, 4 hay personas presentes, 5-10 desocupadas...
  const c1 = loadCuadro('c2022_bsas_vivienda_c1_2.xlsx', 'Cuadro1.2');
  const moronRow1 = findPartidoRow(c1, MORON.codigo, MORON.nombre);
  const totalViv = toNumber(moronRow1[2]);
  const particulares = toNumber(moronRow1[3]);
  const ocupadas = toNumber(moronRow1[4]);
  const desocupadas = particulares - ocupadas;

  // vivienda_c3: tipo de vivienda — cols 3..9 (casa, rancho, casilla, depto, pieza, local, movil)
  const c3 = loadCuadro('c2022_bsas_vivienda_c3_2.xlsx', 'Cuadro 3.2');
  const moronRow3 = findPartidoRow(c3, MORON.codigo, MORON.nombre);
  const totalParticulares = toNumber(moronRow3[2]);
  const tipos = [
    { label: 'Casa', value: toNumber(moronRow3[3]) },
    { label: 'Rancho', value: toNumber(moronRow3[4]) },
    { label: 'Casilla', value: toNumber(moronRow3[5]) },
    { label: 'Departamento', value: toNumber(moronRow3[6]) },
    { label: 'Pieza inquilinato', value: toNumber(moronRow3[7]) },
    { label: 'Local no construido para habitar', value: toNumber(moronRow3[8]) },
    { label: 'Vivienda móvil', value: toNumber(moronRow3[9]) },
  ].filter(t => t.value != null && t.value > 0);

  const casa = tipos.find(t => t.label === 'Casa')?.value || 0;
  const depto = tipos.find(t => t.label === 'Departamento')?.value || 0;
  const pctCasa = (casa / totalParticulares) * 100;
  const pctDepto = (depto / totalParticulares) * 100;

  // vivienda_c2: hogares por vivienda
  const c2 = loadCuadro('c2022_bsas_vivienda_c2_2.xlsx', 'Cuadro2.2');
  const moronRow2 = findPartidoRow(c2, MORON.codigo, MORON.nombre);
  const vivOcup = toNumber(moronRow2[2]);
  const hogTotal = toNumber(moronRow2[3]);
  const unHog = toNumber(moronRow2[4]);
  const dosHog = toNumber(moronRow2[6]);
  const tresOMas = toNumber(moronRow2[8]);
  const pctMultiHogar = ((dosHog + tresOMas) / vivOcup) * 100;

  // Rankings GBA24: total viviendas, % desocupación
  const gbaTotal = extractAllPartidosCol(c1, 2);
  const gbaOcup = extractAllPartidosCol(c1, 4);
  const gbaPart = extractAllPartidosCol(c1, 3);
  const gbaDeptoPct = GBA24.map(p => {
    const r = findPartidoRow(c3, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const tot = toNumber(r[2]);
    const dept = toNumber(r[6]);
    return { codigo: p.codigo, nombre: p.nombre, value: tot ? (dept / tot) * 100 : null };
  });

  const data = {
    meta: {
      id: 'poblacion-viviendas',
      title: 'Stock Habitacional y Viviendas — Morón',
      category: 'Población',
      subcategory: 'Viviendas',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'total-viv', label: 'Total de viviendas', value: totalViv, formatted: fmtInt(totalViv), unit: 'viv' },
      { id: 'ocupadas', label: 'Viviendas ocupadas', value: ocupadas, formatted: fmtInt(ocupadas), comparison: `${fmtPct((ocupadas/particulares)*100)} del stock particular` },
      { id: 'desocupadas', label: 'Viviendas desocupadas', value: desocupadas, formatted: fmtInt(desocupadas), status: 'warning', comparison: `${fmtPct((desocupadas/particulares)*100)} del stock` },
      { id: 'casa', label: '% Casas', value: pctCasa, formatted: fmtPct(pctCasa), comparison: `${fmtInt(casa)} viviendas` },
      { id: 'depto', label: '% Departamentos', value: pctDepto, formatted: fmtPct(pctDepto), comparison: `${fmtInt(depto)} viviendas` },
      { id: 'multihogar', label: '% Viv. con 2+ hogares', value: pctMultiHogar, formatted: fmtPct(pctMultiHogar), status: pctMultiHogar > 2 ? 'warning' : 'good', comparison: 'Indicador de hacinamiento estructural' },
    ],
    charts: [
      {
        id: 'tipos-viv',
        type: 'pie',
        title: 'Composición por tipo de vivienda particular — Morón',
        sectionId: 'tipos',
        data: tipos.map(t => ({ id: t.label, label: t.label, value: t.value })),
      },
      {
        id: 'gba-total',
        type: 'bar',
        title: 'Total de viviendas por partido — 24 GBA',
        sectionId: 'comparacion',
        data: rankGBA(gbaTotal).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
      {
        id: 'gba-depto',
        type: 'bar',
        title: '% de departamentos sobre total particular — 24 GBA',
        sectionId: 'comparacion',
        data: rankGBA(gbaDeptoPct).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-total', title: 'Viviendas totales — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaTotal), order: 'desc' },
      { id: 'rk-depto', title: '% Departamentos — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaDeptoPct), order: 'desc' },
    ],
    mapData: buildFeatured(totalViv, fmtInt(totalViv), 'Viviendas totales en Morón'),
  };

  writeJson(path.join(OUT_DIR, 'viviendas.json'), data);
  return { totalViv, pctCasa, pctDepto, pctMultiHogar };
}

// ════════════════════════════════════════════════════════════════════
// 3. HOGARES
// ════════════════════════════════════════════════════════════════════
function processHogares() {
  console.log('\n─── Hogares ───');

  // hogares_c4: combustible cocinar
  // cols: 0 cod, 1 partido, 2 total hogares, 3 electricidad, 4 gas red, 5 granel, 6 garrafa, 7 leña, 8 otro
  const c4 = loadCuadro('c2022_bsas_hogares_c4_2.xlsx', 'Cuadro4.2');
  const moronR4 = findPartidoRow(c4, MORON.codigo, MORON.nombre);
  const totalHog = toNumber(moronR4[2]);
  const combustibles = [
    { label: 'Gas de red', value: toNumber(moronR4[4]) },
    { label: 'Gas en garrafa', value: toNumber(moronR4[6]) },
    { label: 'Gas a granel', value: toNumber(moronR4[5]) },
    { label: 'Electricidad', value: toNumber(moronR4[3]) },
    { label: 'Leña/carbón', value: toNumber(moronR4[7]) },
    { label: 'Otro', value: toNumber(moronR4[8]) },
  ].filter(t => t.value != null && t.value > 0);
  const gasRed = combustibles.find(c => c.label === 'Gas de red')?.value || 0;
  const pctGasRed = (gasRed / totalHog) * 100;
  const garrafa = combustibles.find(c => c.label === 'Gas en garrafa')?.value || 0;
  const pctGarrafa = (garrafa / totalHog) * 100;

  // hogares_c6: régimen tenencia
  // cols: 0 cod, 1 partido, 2 total, 3 propia total, 4 escritura, 5 boleto, 6 otra doc, 7 sin doc, 8 alquilada, 9 cedida trabajo...
  const c6 = loadCuadro('c2022_bsas_hogares_c6_2.xlsx', 'Cuadro6.2');
  const moronR6 = findPartidoRow(c6, MORON.codigo, MORON.nombre);
  const totalH6 = toNumber(moronR6[2]);
  const propia = toNumber(moronR6[3]);
  const conEscritura = toNumber(moronR6[4]);
  const alquilada = toNumber(moronR6[8]);
  const pctPropia = (propia / totalH6) * 100;
  const pctEscritura = (conEscritura / totalH6) * 100;
  const pctAlquiler = (alquilada / totalH6) * 100;
  const pctIrregular = ((propia - conEscritura) / totalH6) * 100; // propia sin escritura

  // GBA rankings
  const gbaTot = extractAllPartidosCol(c4, 2);
  const gbaGasRed = GBA24.map(p => {
    const r = findPartidoRow(c4, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const tot = toNumber(r[2]); const gr = toNumber(r[4]);
    return { codigo: p.codigo, nombre: p.nombre, value: tot ? (gr / tot) * 100 : null };
  });
  const gbaAlq = GBA24.map(p => {
    const r = findPartidoRow(c6, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const tot = toNumber(r[2]); const alq = toNumber(r[8]);
    return { codigo: p.codigo, nombre: p.nombre, value: tot ? (alq / tot) * 100 : null };
  });

  const data = {
    meta: {
      id: 'poblacion-hogares',
      title: 'Condiciones Habitacionales de los Hogares — Morón',
      category: 'Población',
      subcategory: 'Hogares',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'total-hog', label: 'Total de hogares', value: totalHog, formatted: fmtInt(totalHog), unit: 'hogares' },
      { id: 'gas-red', label: 'Cocinan con gas de red', value: pctGasRed, formatted: fmtPct(pctGasRed), status: pctGasRed > 60 ? 'good' : 'warning', comparison: `${fmtInt(gasRed)} hogares` },
      { id: 'garrafa', label: 'Cocinan con garrafa', value: pctGarrafa, formatted: fmtPct(pctGarrafa), status: pctGarrafa > 40 ? 'warning' : 'good', comparison: `${fmtInt(garrafa)} hogares` },
      { id: 'propia', label: 'Vivienda propia', value: pctPropia, formatted: fmtPct(pctPropia), status: 'good' },
      { id: 'escritura', label: 'Propia con escritura', value: pctEscritura, formatted: fmtPct(pctEscritura) },
      { id: 'alquiler', label: 'Alquilada', value: pctAlquiler, formatted: fmtPct(pctAlquiler) },
    ],
    charts: [
      {
        id: 'combustible',
        type: 'pie',
        title: 'Combustible usado para cocinar — Morón',
        sectionId: 'servicios',
        data: combustibles.map(c => ({ id: c.label, label: c.label, value: c.value })),
      },
      {
        id: 'tenencia',
        type: 'pie',
        title: 'Régimen de tenencia del hogar — Morón',
        sectionId: 'tenencia',
        data: [
          { id: 'Propia con escritura', label: 'Propia con escritura', value: conEscritura },
          { id: 'Propia sin escritura', label: 'Propia sin escritura', value: propia - conEscritura },
          { id: 'Alquilada', label: 'Alquilada', value: alquilada },
          { id: 'Otra', label: 'Otra', value: totalH6 - propia - alquilada },
        ].filter(d => d.value > 0),
      },
      {
        id: 'gba-gasred',
        type: 'bar',
        title: '% Hogares con gas de red — 24 GBA',
        sectionId: 'comparacion',
        data: rankGBA(gbaGasRed).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
      {
        id: 'gba-alq',
        type: 'bar',
        title: '% Hogares alquilados — 24 GBA',
        sectionId: 'comparacion',
        data: rankGBA(gbaAlq).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-gasred', title: '% Gas de red — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaGasRed), order: 'desc' },
      { id: 'rk-alq', title: '% Hogares alquilados — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaAlq), order: 'desc' },
    ],
    mapData: buildFeatured(pctGasRed, fmtPct(pctGasRed), 'De los hogares de Morón cocina con gas de red'),
  };

  writeJson(path.join(OUT_DIR, 'hogares.json'), data);
  return { pctGasRed, pctPropia, pctAlquiler, pctIrregular };
}

// ════════════════════════════════════════════════════════════════════
// 4. HABITACIONAL (PERSONAS)
// ════════════════════════════════════════════════════════════════════
function processHabitacionalPersonas() {
  console.log('\n─── Habitacional (personas) ───');

  // pob_c4: combustible por partido (óptica personas)
  // cols: 0 cod, 1 partido, 2 pob, 3 elec, 4 gas red, 5 granel, 6 garrafa, 7 leña, 8 otro
  const c4 = loadCuadro('c2022_bsas_pob_c4_2.xlsx', 'Cuadro4.2');
  const moronR = findPartidoRow(c4, MORON.codigo, MORON.nombre);
  const pobViv = toNumber(moronR[2]);
  const elec = toNumber(moronR[3]);
  const gasRed = toNumber(moronR[4]);
  const granel = toNumber(moronR[5]);
  const garrafa = toNumber(moronR[6]);
  const lena = toNumber(moronR[7]);
  const pctGasRed = (gasRed / pobViv) * 100;
  const pctGarrafa = (garrafa / pobViv) * 100;

  const gbaGasRed = GBA24.map(p => {
    const r = findPartidoRow(c4, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const pob = toNumber(r[2]); const gr = toNumber(r[4]);
    return { codigo: p.codigo, nombre: p.nombre, value: pob ? (gr / pob) * 100 : null };
  });

  const data = {
    meta: {
      id: 'poblacion-habitacional-personas',
      title: 'Condiciones Habitacionales de la Población — Morón',
      category: 'Población',
      subcategory: 'Habitacional Personas',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'pob-viv', label: 'Población en viv. particulares', value: pobViv, formatted: fmtInt(pobViv), unit: 'hab' },
      { id: 'gas-red', label: 'Usan gas de red', value: pctGasRed, formatted: fmtPct(pctGasRed), comparison: `${fmtInt(gasRed)} personas`, status: pctGasRed > 60 ? 'good' : 'warning' },
      { id: 'garrafa', label: 'Dependen de garrafa', value: pctGarrafa, formatted: fmtPct(pctGarrafa), comparison: `${fmtInt(garrafa)} personas`, status: pctGarrafa > 40 ? 'warning' : 'good' },
      { id: 'electricidad', label: 'Electricidad', value: (elec/pobViv)*100, formatted: fmtPct((elec/pobViv)*100), comparison: `${fmtInt(elec)} personas` },
    ],
    charts: [
      {
        id: 'combustible-personas',
        type: 'pie',
        title: 'Combustible para cocinar — Población Morón',
        sectionId: 'servicios',
        data: [
          { id: 'Gas de red', label: 'Gas de red', value: gasRed },
          { id: 'Gas en garrafa', label: 'Gas en garrafa', value: garrafa },
          { id: 'Gas a granel', label: 'Gas a granel', value: granel },
          { id: 'Electricidad', label: 'Electricidad', value: elec },
          { id: 'Leña/carbón', label: 'Leña/carbón', value: lena },
        ].filter(d => d.value != null && d.value > 0),
      },
      {
        id: 'gba-gasred',
        type: 'bar',
        title: '% Población con gas de red — 24 GBA',
        sectionId: 'comparacion',
        data: rankGBA(gbaGasRed).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-gasred', title: '% Población con gas de red — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaGasRed), order: 'desc' },
    ],
    mapData: buildFeatured(pctGasRed, fmtPct(pctGasRed), 'De la población de Morón vive en hogares con gas de red'),
  };

  writeJson(path.join(OUT_DIR, 'habitacional-personas.json'), data);
  return { pctGasRed, pctGarrafa };
}

// ════════════════════════════════════════════════════════════════════
// 5. SALUD
// ════════════════════════════════════════════════════════════════════
function processSalud() {
  console.log('\n─── Salud ───');

  // salud_c1: Cobertura de salud
  // cols: 0 cod, 1 depto, 2 pob total, 3 Obra social o prepaga, 4 Plan estatal, 5 No tiene
  const c1 = loadCuadro('c2022_bsas_salud_c1_2.xlsx', 'Cobertura de Salud N°1.2');
  const moronR = findPartidoRow(c1, MORON.codigo, MORON.nombre);
  const pob = toNumber(moronR[2]);
  const obraSocial = toNumber(moronR[3]);
  const planEstatal = toNumber(moronR[4]);
  const sinCobertura = toNumber(moronR[5]);
  const pctOS = (obraSocial / pob) * 100;
  const pctEstatal = (planEstatal / pob) * 100;
  const pctSin = (sinCobertura / pob) * 100;

  const gbaSin = GBA24.map(p => {
    const r = findPartidoRow(c1, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const po = toNumber(r[2]); const sin_ = toNumber(r[5]);
    return { codigo: p.codigo, nombre: p.nombre, value: po ? (sin_ / po) * 100 : null };
  });
  const gbaOS = GBA24.map(p => {
    const r = findPartidoRow(c1, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const po = toNumber(r[2]); const o = toNumber(r[3]);
    return { codigo: p.codigo, nombre: p.nombre, value: po ? (o / po) * 100 : null };
  });

  const data = {
    meta: {
      id: 'poblacion-salud',
      title: 'Cobertura de Salud — Morón',
      category: 'Población',
      subcategory: 'Salud',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'obra-social', label: 'Obra social / prepaga', value: pctOS, formatted: fmtPct(pctOS), status: 'good', comparison: `${fmtInt(obraSocial)} personas (incluye PAMI)` },
      { id: 'plan-estatal', label: 'Plan estatal de salud', value: pctEstatal, formatted: fmtPct(pctEstatal), comparison: `${fmtInt(planEstatal)} personas` },
      { id: 'sin-cobertura', label: 'Sin cobertura', value: pctSin, formatted: fmtPct(pctSin), status: pctSin > 25 ? 'critical' : 'warning', comparison: `${fmtInt(sinCobertura)} personas` },
      { id: 'pob-total', label: 'Población en viv. particulares', value: pob, formatted: fmtInt(pob), unit: 'hab' },
    ],
    charts: [
      {
        id: 'cobertura',
        type: 'pie',
        title: 'Tipo de cobertura de salud — Morón',
        sectionId: 'cobertura',
        data: [
          { id: 'Obra social / prepaga', label: 'Obra social / prepaga', value: obraSocial },
          { id: 'Plan estatal', label: 'Plan estatal', value: planEstatal },
          { id: 'Sin cobertura', label: 'Sin cobertura', value: sinCobertura },
        ],
      },
      {
        id: 'gba-sin',
        type: 'bar',
        title: '% sin cobertura — 24 GBA',
        sectionId: 'comparacion',
        data: rankGBA(gbaSin).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-os', title: '% con obra social/prepaga — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaOS), order: 'desc' },
      { id: 'rk-sin', title: '% sin cobertura — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaSin), order: 'desc' },
    ],
    mapData: buildFeatured(pctSin, fmtPct(pctSin), 'De la población de Morón no tiene obra social, prepaga ni plan estatal'),
  };

  writeJson(path.join(OUT_DIR, 'salud.json'), data);
  return { pctOS, pctSin };
}

// ════════════════════════════════════════════════════════════════════
// 6. PREVISIÓN SOCIAL
// ════════════════════════════════════════════════════════════════════
function processPrevision() {
  console.log('\n─── Previsión social ───');

  // prevision_c3: jubilación/pensión por departamento
  // cols: 0 cod, 1 depto, 2 pob, 3 percibe total, 4 solo jubilación, 5 solo pensión, 6 jub+pensión, 7 otra pensión, 8 No percibe
  const c3 = loadCuadro('c2022_bsas_prevision_c3_2.xlsx', 'Previsión social N°3.2');
  const moronR = findPartidoRow(c3, MORON.codigo, MORON.nombre);
  const pob = toNumber(moronR[2]);
  const percibe = toNumber(moronR[3]);
  const soloJub = toNumber(moronR[4]);
  const soloPension = toNumber(moronR[5]);
  const pctPercibe = (percibe / pob) * 100;
  const pctJub = (soloJub / pob) * 100;

  const gbaPct = GBA24.map(p => {
    const r = findPartidoRow(c3, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const po = toNumber(r[2]); const pe = toNumber(r[3]);
    return { codigo: p.codigo, nombre: p.nombre, value: po ? (pe / po) * 100 : null };
  });

  const data = {
    meta: {
      id: 'poblacion-prevision',
      title: 'Previsión Social — Morón',
      category: 'Población',
      subcategory: 'Previsión',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'pct-percibe', label: 'Percibe jubilación/pensión', value: pctPercibe, formatted: fmtPct(pctPercibe), comparison: `${fmtInt(percibe)} personas` },
      { id: 'jub', label: 'Solo jubilación', value: pctJub, formatted: fmtPct(pctJub), comparison: `${fmtInt(soloJub)} personas` },
      { id: 'pension', label: 'Solo pensión por fallecimiento', value: (soloPension/pob)*100, formatted: fmtPct((soloPension/pob)*100), comparison: `${fmtInt(soloPension)} personas` },
      { id: 'no-percibe', label: 'No percibe', value: ((pob-percibe)/pob)*100, formatted: fmtPct(((pob-percibe)/pob)*100), comparison: `${fmtInt(pob-percibe)} personas` },
    ],
    charts: [
      {
        id: 'percibe',
        type: 'pie',
        title: 'Composición de beneficios previsionales — Morón',
        sectionId: 'composicion',
        data: [
          { id: 'Solo jubilación', label: 'Solo jubilación', value: soloJub },
          { id: 'Solo pensión', label: 'Solo pensión fallecimiento', value: soloPension },
          { id: 'Jubilación + pensión', label: 'Jubilación + pensión', value: toNumber(moronR[6]) || 0 },
          { id: 'Otra pensión', label: 'Otra pensión', value: toNumber(moronR[7]) || 0 },
          { id: 'No percibe', label: 'No percibe', value: pob - percibe },
        ].filter(d => d.value > 0),
      },
      {
        id: 'gba-percibe',
        type: 'bar',
        title: '% Percibe jubilación/pensión — 24 GBA',
        sectionId: 'comparacion',
        data: rankGBA(gbaPct).map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-percibe', title: '% Percibe jubilación/pensión — 24 GBA', sectionId: 'comparacion', items: rankGBA(gbaPct), order: 'desc' },
    ],
    mapData: buildFeatured(pctPercibe, fmtPct(pctPercibe), 'De la población de Morón percibe jubilación o pensión'),
  };

  writeJson(path.join(OUT_DIR, 'prevision.json'), data);
  return { pctPercibe };
}

// ════════════════════════════════════════════════════════════════════
// 7. ACTIVIDAD ECONÓMICA
// Fuente: actividad_economica_c1_2 (partido-level)
// ════════════════════════════════════════════════════════════════════
function processActividadEconomica() {
  console.log('\n─── Actividad Económica ───');

  const c1 = loadCuadro('c2022_bsas_actividad_economica_c1_2.xlsx', 'Cuadro 1. 2');
  const moronRow = findPartidoRow(c1, MORON.codigo, MORON.nombre);
  const pob14 = toNumber(moronRow[2]);
  const pea = toNumber(moronRow[3]);
  const ocupada = toNumber(moronRow[4]);
  const desocupada = toNumber(moronRow[5]);
  const pnea = toNumber(moronRow[6]);

  const tasaActividad = (pea / pob14) * 100;
  const tasaEmpleo = (ocupada / pob14) * 100;
  const tasaDesempleo = (desocupada / pea) * 100;

  // GBA24 — rankings de las tres tasas
  const gbaRows = GBA24.map(p => {
    const r = findPartidoRow(c1, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, actividad: null, empleo: null, desempleo: null };
    const p14 = toNumber(r[2]);
    const peaP = toNumber(r[3]);
    const ocP = toNumber(r[4]);
    const desP = toNumber(r[5]);
    return {
      codigo: p.codigo,
      nombre: p.nombre,
      actividad: p14 ? (peaP / p14) * 100 : null,
      empleo: p14 ? (ocP / p14) * 100 : null,
      desempleo: peaP ? (desP / peaP) * 100 : null,
    };
  });

  const rkActividad = rankGBA(gbaRows.map(r => ({ codigo: r.codigo, nombre: r.nombre, value: r.actividad })));
  const rkEmpleo = rankGBA(gbaRows.map(r => ({ codigo: r.codigo, nombre: r.nombre, value: r.empleo })));
  const rkDesempleo = rankGBA(gbaRows.map(r => ({ codigo: r.codigo, nombre: r.nombre, value: r.desempleo })));

  const data = {
    meta: {
      id: 'poblacion-actividad-economica',
      title: 'Actividad Económica — Morón',
      category: 'Población',
      subcategory: 'Actividad Económica',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'pob14', label: 'Población 14+', value: pob14, formatted: fmtInt(pob14), unit: 'personas' },
      { id: 'tasa-actividad', label: 'Tasa de actividad', value: tasaActividad, formatted: fmtPct(tasaActividad), comparison: 'PEA / Pob 14+' },
      { id: 'tasa-empleo', label: 'Tasa de empleo', value: tasaEmpleo, formatted: fmtPct(tasaEmpleo), status: 'good', comparison: 'Ocupada / Pob 14+' },
      { id: 'tasa-desempleo', label: 'Tasa de desempleo', value: tasaDesempleo, formatted: fmtPct(tasaDesempleo), status: tasaDesempleo > 10 ? 'warning' : 'good', comparison: 'Desocupada / PEA' },
      { id: 'pea', label: 'Económicamente activa', value: pea, formatted: fmtInt(pea), unit: 'personas' },
      { id: 'pnea', label: 'No económicamente activa', value: pnea, formatted: fmtInt(pnea), unit: 'personas' },
    ],
    charts: [
      {
        id: 'composicion',
        type: 'pie',
        title: 'Composición de la población de 14 años y más — Morón',
        sectionId: 'composicion',
        data: [
          { id: 'Ocupada', label: 'Ocupada', value: ocupada },
          { id: 'Desocupada', label: 'Desocupada', value: desocupada },
          { id: 'No económicamente activa', label: 'No económicamente activa', value: pnea },
        ],
      },
      {
        id: 'gba-empleo',
        type: 'bar',
        title: 'Tasa de empleo — 24 partidos GBA',
        sectionId: 'comparacion',
        data: rkEmpleo.map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
      {
        id: 'gba-desempleo',
        type: 'bar',
        title: 'Tasa de desempleo — 24 partidos GBA',
        sectionId: 'comparacion',
        data: rkDesempleo.map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-actividad', title: 'Tasa de actividad — 24 GBA', sectionId: 'comparacion', items: rkActividad, order: 'desc' },
      { id: 'rk-empleo', title: 'Tasa de empleo — 24 GBA', sectionId: 'comparacion', items: rkEmpleo, order: 'desc' },
      { id: 'rk-desempleo', title: 'Tasa de desempleo — 24 GBA', sectionId: 'comparacion', items: rkDesempleo, order: 'desc' },
    ],
    mapData: buildFeatured(tasaEmpleo, fmtPct(tasaEmpleo), 'De la población de 14+ de Morón está ocupada'),
  };

  writeJson(path.join(OUT_DIR, 'actividad-economica.json'), data);
  return { tasaEmpleo, tasaDesempleo };
}

// ════════════════════════════════════════════════════════════════════
// 8. EDUCACIÓN
// Fuentes: educacion_c1_2 (asistencia) + educacion_c3_2 (máximo nivel)
// Ambos con datos por partido en sub-hojas "Cuadro X.2.N"
// ════════════════════════════════════════════════════════════════════
function processEducacion() {
  console.log('\n─── Educación ───');

  // ── Asistencia escolar (Morón, sub-hoja 87) ──
  const c1 = loadCuadro('c2022_bsas_educacion_c1_2.xlsx', 'Cuadro 1.2.87');
  const totalR1 = findTotalRow(c1);
  const popTotal = toNumber(totalR1[2]);      // Población en viviendas particulares
  const asisteAct = toNumber(totalR1[3]);      // Asiste actualmente
  const asistio = toNumber(totalR1[4]);        // No asiste pero asistió
  const nuncaAsis = toNumber(totalR1[5]);      // Nunca asistió

  const pctAsisteAct = (asisteAct / popTotal) * 100;
  const pctAlfabetizado = ((asisteAct + asistio) / popTotal) * 100;
  const pctNuncaAsis = (nuncaAsis / popTotal) * 100;

  // ── Máximo nivel educativo (Morón, sub-hoja 87) ──
  const c3 = loadCuadro('c2022_bsas_educacion_c3_2.xlsx', 'Cuadro 3.2.87');
  const totalR3 = findTotalRow(c3);
  const pob5Mas = toNumber(totalR3[2]);
  const pobConEstudios = toNumber(totalR3[3]);
  const sinInst = toNumber(totalR3[4]);
  const primarioTotal = toNumber(totalR3[5]);
  const primarioCompleto = toNumber(totalR3[7]);
  const secundarioTotal = toNumber(totalR3[11]);
  const secundarioCompleto = toNumber(totalR3[13]);
  const terciarioNoUniv = toNumber(totalR3[17]);
  const universitario = toNumber(totalR3[20]);
  const posgrado = toNumber(totalR3[23]);

  const pctSecCompleto = (secundarioCompleto / pob5Mas) * 100;
  const pctUniversitario = (universitario / pob5Mas) * 100;
  const pctSinInst = (sinInst / pob5Mas) * 100;
  const pctPrimarioCompleto = (primarioCompleto / pob5Mas) * 100;
  const pctTerciario = (terciarioNoUniv / pob5Mas) * 100;
  const pctPosgrado = (posgrado / pob5Mas) * 100;

  // ── GBA24 ranking: % con nivel universitario completo ──
  // Iterar sub-hojas de educación_c3_2 alfabéticamente numeradas.
  const wb3 = XLSX.readFile(path.join(CENSO_DIR, 'c2022_bsas_educacion_c3_2.xlsx'));
  const sheetIndex = buildPartidoSheetIndex(wb3, 'Cuadro 3.2');

  const gbaRows = GBA24.map(p => {
    const sheetName = sheetIndex[normalize(p.nombre)];
    if (!sheetName) return { codigo: p.codigo, nombre: p.nombre, pctUniv: null, pctSec: null, pctSinInst: null };
    const sheet = wb3.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
    const tRow = findTotalRow(rows);
    if (!tRow) return { codigo: p.codigo, nombre: p.nombre, pctUniv: null, pctSec: null, pctSinInst: null };
    const pob = toNumber(tRow[2]);
    const univ = toNumber(tRow[20]);
    const secCompl = toNumber(tRow[13]);
    const sinI = toNumber(tRow[4]);
    return {
      codigo: p.codigo,
      nombre: p.nombre,
      pctUniv: pob ? (univ / pob) * 100 : null,
      pctSec: pob ? (secCompl / pob) * 100 : null,
      pctSinInst: pob ? (sinI / pob) * 100 : null,
    };
  });

  const rkUniv = rankGBA(gbaRows.map(r => ({ codigo: r.codigo, nombre: r.nombre, value: r.pctUniv })));
  const rkSec = rankGBA(gbaRows.map(r => ({ codigo: r.codigo, nombre: r.nombre, value: r.pctSec })));
  const rkSinInst = rankGBA(gbaRows.map(r => ({ codigo: r.codigo, nombre: r.nombre, value: r.pctSinInst })));

  const data = {
    meta: {
      id: 'poblacion-educacion',
      title: 'Educación — Morón',
      category: 'Población',
      subcategory: 'Educación',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'asiste-actual', label: 'Asiste actualmente', value: pctAsisteAct, formatted: fmtPct(pctAsisteAct), status: 'good' },
      { id: 'alfabetizado', label: 'Alguna vez asistió', value: pctAlfabetizado, formatted: fmtPct(pctAlfabetizado), status: 'good' },
      { id: 'sec-completo', label: 'Secundario completo', value: pctSecCompleto, formatted: fmtPct(pctSecCompleto) },
      { id: 'universitario', label: 'Universitario completo', value: pctUniversitario, formatted: fmtPct(pctUniversitario), status: 'good' },
      { id: 'nunca-asistio', label: 'Nunca asistió', value: pctNuncaAsis, formatted: fmtPct(pctNuncaAsis), status: pctNuncaAsis > 3 ? 'warning' : 'good' },
      { id: 'sin-instruccion', label: 'Sin instrucción', value: pctSinInst, formatted: fmtPct(pctSinInst, 2) },
    ],
    charts: [
      {
        id: 'nivel',
        type: 'pie',
        title: 'Máximo nivel educativo alcanzado — Morón',
        sectionId: 'nivel',
        data: [
          { id: 'Sin instrucción', label: 'Sin instrucción', value: sinInst },
          { id: 'Primario completo', label: 'Primario completo', value: primarioCompleto },
          { id: 'Secundario completo', label: 'Secundario completo', value: secundarioCompleto },
          { id: 'Terciario', label: 'Terciario no universitario', value: terciarioNoUniv },
          { id: 'Universitario', label: 'Universitario completo', value: universitario },
          { id: 'Posgrado', label: 'Posgrado', value: posgrado },
        ].filter(d => d.value > 0),
      },
      {
        id: 'asistencia',
        type: 'pie',
        title: 'Condición de asistencia escolar — Morón',
        sectionId: 'asistencia',
        data: [
          { id: 'Asiste', label: 'Asiste actualmente', value: asisteAct },
          { id: 'Asistió', label: 'No asiste pero asistió', value: asistio },
          { id: 'Nunca', label: 'Nunca asistió', value: nuncaAsis },
        ].filter(d => d.value > 0),
      },
      {
        id: 'gba-univ',
        type: 'bar',
        title: '% con universitario completo — 24 partidos GBA',
        sectionId: 'comparacion',
        data: rkUniv.map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-univ', title: '% con universitario completo — 24 GBA', sectionId: 'comparacion', items: rkUniv, order: 'desc' },
      { id: 'rk-sec', title: '% con secundario completo — 24 GBA', sectionId: 'comparacion', items: rkSec, order: 'desc' },
      { id: 'rk-sin-inst', title: '% sin instrucción — 24 GBA', sectionId: 'comparacion', items: rkSinInst, order: 'asc' },
    ],
    mapData: buildFeatured(pctSecCompleto, fmtPct(pctSecCompleto), 'De la población de 5+ de Morón completó al menos el secundario'),
  };

  writeJson(path.join(OUT_DIR, 'educacion.json'), data);
  return { pctSecCompleto, pctUniversitario };
}

// ════════════════════════════════════════════════════════════════════
// 9. FECUNDIDAD (cuadro general)
// Fuente: fecundidad_c1_2 — partido-level con celdas combinadas "cod nombre"
// ════════════════════════════════════════════════════════════════════
function processFecundidad() {
  console.log('\n─── Fecundidad ───');

  const c1 = loadCuadro('c2022_bsas_fecundidad_c1_2.xlsx', 'Cuadro 1.2');
  const moronRow = findPartidoRow(c1, MORON.codigo, MORON.nombre);
  if (!moronRow) throw new Error('No se encontró fila de Morón en fecundidad c1.2');

  const mujeres = toNumber(moronRow[1]);
  const sinHijos = toNumber(moronRow[2]);
  const h1 = toNumber(moronRow[3]);
  const h2 = toNumber(moronRow[4]);
  const h3 = toNumber(moronRow[5]);
  const h4 = toNumber(moronRow[6]);
  const h5Mas = toNumber(moronRow[7]);
  const promedioRaw = toNumber(moronRow[8]);

  // Algunos cuadros INDEC muestran el promedio como entero tras redondeo de Excel;
  // si resulta entero, recomputarlo a partir de los recuentos por categoría.
  const calcPromedio = (0 * sinHijos + 1 * h1 + 2 * h2 + 3 * h3 + 4 * h4 + 5 * h5Mas) / mujeres;
  const promedio = (promedioRaw != null && promedioRaw > 0 && promedioRaw % 1 !== 0) ? promedioRaw : calcPromedio;

  const pctSinHijos = (sinHijos / mujeres) * 100;
  const pct1o2 = ((h1 + h2) / mujeres) * 100;
  const pct3Mas = ((h3 + h4 + h5Mas) / mujeres) * 100;

  // GBA24 ranking — promedio de hijos e hijas por mujer
  const gbaRows = GBA24.map(p => {
    const r = findPartidoRow(c1, p.codigo, p.nombre);
    if (!r) return { codigo: p.codigo, nombre: p.nombre, value: null };
    const muj = toNumber(r[1]);
    const sh = toNumber(r[2]);
    const x1 = toNumber(r[3]);
    const x2 = toNumber(r[4]);
    const x3 = toNumber(r[5]);
    const x4 = toNumber(r[6]);
    const x5 = toNumber(r[7]);
    const prom = muj ? (0 * sh + 1 * x1 + 2 * x2 + 3 * x3 + 4 * x4 + 5 * x5) / muj : null;
    return { codigo: p.codigo, nombre: p.nombre, value: prom };
  });
  const rkPromedio = rankGBA(gbaRows);

  const data = {
    meta: {
      id: 'poblacion-fecundidad',
      title: 'Fecundidad — Morón',
      category: 'Población',
      subcategory: 'Fecundidad',
      source: SOURCE,
      date: DATE,
    },
    kpis: [
      { id: 'mujeres-14-49', label: 'Mujeres de 14 a 49 años', value: mujeres, formatted: fmtInt(mujeres), unit: 'personas' },
      { id: 'promedio', label: 'Promedio de hijas e hijos', value: promedio, formatted: fmtDec(promedio, 2), comparison: 'Por mujer de 14-49' },
      { id: 'sin-hijos', label: 'Sin hijos', value: pctSinHijos, formatted: fmtPct(pctSinHijos) },
      { id: 'uno-dos', label: 'Con 1 o 2 hijos', value: pct1o2, formatted: fmtPct(pct1o2) },
      { id: 'tres-mas', label: 'Con 3 o más', value: pct3Mas, formatted: fmtPct(pct3Mas) },
    ],
    charts: [
      {
        id: 'distribucion',
        type: 'bar',
        title: 'Mujeres de 14 a 49 años por cantidad de hijas e hijos nacidos vivos — Morón',
        sectionId: 'distribucion',
        data: [
          { cantidad: 'Ninguno', mujeres: sinHijos },
          { cantidad: '1', mujeres: h1 },
          { cantidad: '2', mujeres: h2 },
          { cantidad: '3', mujeres: h3 },
          { cantidad: '4', mujeres: h4 },
          { cantidad: '5 y más', mujeres: h5Mas },
        ],
        config: { xAxis: 'cantidad' },
      },
      {
        id: 'gba-promedio',
        type: 'bar',
        title: 'Promedio de hijas e hijos por mujer (14-49) — 24 partidos GBA',
        sectionId: 'comparacion',
        data: rkPromedio.map(r => ({ partido: r.name, value: r.value })),
        config: { xAxis: 'partido', layout: 'horizontal' },
      },
    ],
    rankings: [
      { id: 'rk-promedio', title: 'Promedio de hijas e hijos por mujer (14-49) — 24 GBA', sectionId: 'comparacion', items: rkPromedio, order: 'desc' },
    ],
    mapData: buildFeatured(promedio, fmtDec(promedio, 2), 'Promedio de hijas e hijos por mujer de 14 a 49 años en Morón'),
  };

  writeJson(path.join(OUT_DIR, 'fecundidad.json'), data);
  return { promedio };
}

// ════════════════════════════════════════════════════════════════════
// RESUMEN — Gobierno local y viviendas colectivas
// Cuadro chico pero con datos únicos: categoría del municipio, viviendas
// colectivas, población en situación de calle. Se emite para consumo de
// la Landing (cuadro resumen debajo del hero).
// ════════════════════════════════════════════════════════════════════
function processResumenGobierno() {
  console.log('\n─── Resumen gobierno local ───');

  const rows = loadCuadro('c2022_bsas_gobierno_local_c1.xlsx', 'Cuadro 1.2');
  // Formato: col 4 = nombre del gobierno local. Morón se matchea por nombre.
  const moron = rows.find(r => r && /^\s*mor[oó]n\s*$/i.test(String(r[4] || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  if (!moron) throw new Error('No se encontró fila de Morón en gobierno_local');

  const categoria = String(moron[3] || '').trim();  // 'MU'
  const totalViv = toNumber(moron[5]);
  const pobTotal = toNumber(moron[6]);
  const vivPart = toNumber(moron[7]);
  const pobPart = toNumber(moron[8]);
  const vivCol = toNumber(moron[9]);
  const pobCol = toNumber(moron[10]);
  const pobCalle = toNumber(moron[11]) ?? 0;

  const categoriaFull = ({
    'MU': 'Municipio de única categoría',
    'M1': 'Municipio de 1° categoría',
    'M2': 'Municipio de 2° categoría',
    'M3': 'Municipio de 3° categoría',
  })[categoria] || categoria;

  const resumen = {
    source: SOURCE,
    date: DATE,
    categoriaCod: categoria,
    categoria: categoriaFull,
    totalViviendas: totalViv,
    viviendasParticulares: vivPart,
    viviendasColectivas: vivCol,
    poblacionTotal: pobTotal,
    poblacionEnViviendasParticulares: pobPart,
    poblacionEnViviendasColectivas: pobCol,
    poblacionEnSituacionDeCalle: pobCalle,
  };

  writeJson(path.join(__dirname, '..', 'public', 'data', 'resumen.json'), resumen);
  return resumen;
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Procesando POBLACIÓN — Censo 2022 (Morón)     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  processEstructura();
  processViviendas();
  processHogares();
  processHabitacionalPersonas();
  processSalud();
  processPrevision();
  processActividadEconomica();
  processEducacion();
  processFecundidad();
  processResumenGobierno();
  console.log('\n✅ Done.');
}

if (require.main === module) {
  main();
}

module.exports = { main };
