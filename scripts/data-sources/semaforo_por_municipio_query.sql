COPY (
  WITH ult AS (
    SELECT DISTINCT ON (r.escuela_id) r.escuela_id, e.municipio_id, r.estado
    FROM relevamientos r
    JOIN escuelas e ON e.id = r.escuela_id
    WHERE r.aprobacion_status = 'aprobado'
    ORDER BY r.escuela_id, r.created_at DESC
  )
  SELECT m.nombre AS municipio,
         count(*)                                  AS total,
         count(*) FILTER (WHERE u.estado='rojo')     AS rojo,
         count(*) FILTER (WHERE u.estado='amarillo') AS amarillo,
         count(*) FILTER (WHERE u.estado='verde')    AS verde
  FROM ult u
  JOIN municipios m ON m.id = u.municipio_id
  GROUP BY m.nombre
  ORDER BY m.nombre
) TO STDOUT WITH CSV HEADER;
