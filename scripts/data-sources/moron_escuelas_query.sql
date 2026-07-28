COPY (
  WITH ult AS (
    SELECT DISTINCT ON (r.escuela_id) r.escuela_id, r.estado, r.estado_motivo
    FROM relevamientos r
    JOIN escuelas e ON e.id = r.escuela_id
    JOIN municipios m ON m.id = e.municipio_id
    WHERE r.aprobacion_status = 'aprobado' AND upper(m.nombre) = 'MORON'
    ORDER BY r.escuela_id, r.created_at DESC
  )
  SELECT e.cue, e.nombre AS escuela, e.lat, e.lon, u.estado,
         u.estado_motivo AS motivo, e.localidad
  FROM ult u
  JOIN escuelas e ON e.id = u.escuela_id
  ORDER BY u.estado, e.nombre
) TO STDOUT WITH CSV HEADER;
