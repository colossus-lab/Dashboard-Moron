-- Borra todos los mensajes y reportes existentes en el muro.
-- Se ejecuta una vez para limpiar mensajes de prueba antes del lanzamiento.
-- Es seguro re-ejecutar (idempotente): si las tablas están vacías, no hace nada.

-- Primero borramos los reportes (FK a messages) y luego los mensajes.
DELETE FROM public.reports;
DELETE FROM public.messages;
