PRAGMA foreign_keys = ON;

-- =========================
-- 1) Catálogos
-- =========================

CREATE TABLE IF NOT EXISTS turno (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS maquina (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_plancha (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL UNIQUE
);

-- Catálogo sugerido de variaciones (NO FK en pedido por ahora)
CREATE TABLE IF NOT EXISTS variacion_material (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL UNIQUE
);

-- =========================
-- 2) Registro de turno
-- =========================

CREATE TABLE IF NOT EXISTS registro_turno (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  operador_nombre   TEXT NOT NULL CHECK(length(trim(operador_nombre)) >= 2),
  operador_apellido TEXT NOT NULL CHECK(length(trim(operador_apellido)) >= 2),

  fecha             TEXT NOT NULL DEFAULT (date('now')),
  creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_registro_turno_busqueda
ON registro_turno (fecha, operador_apellido, operador_nombre);

-- =========================
-- 3) Pedido
-- =========================

CREATE TABLE IF NOT EXISTS pedido (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_turno_id         INTEGER NOT NULL,
  turno_id                  INTEGER NOT NULL,

  fecha_registro            TEXT NOT NULL DEFAULT (date('now')),
  creado_en                 TEXT NOT NULL DEFAULT (datetime('now')),
  modificado_en             TEXT NULL DEFAULT (datetime('now')),

  codigo_producto           TEXT NOT NULL CHECK(length(trim(codigo_producto)) >= 1),
  descripcion_producto      TEXT NOT NULL CHECK(length(trim(descripcion_producto)) >= 10),

  maquina_asignada          TEXT NOT NULL CHECK(maquina_asignada IN ('BOF', 'Rover', 'Ambas')),

  tipo_plancha_id           INTEGER NOT NULL,
  espesor_mm                REAL NOT NULL CHECK(espesor_mm > 0),

  medida_plancha            TEXT NOT NULL CHECK(length(trim(medida_plancha)) >= 3),
  variacion_material        TEXT NOT NULL CHECK(length(trim(variacion_material)) >= 1),

  planchas_asignadas        INTEGER NOT NULL CHECK(planchas_asignadas > 0),

  ultima_plancha_trabajada  INTEGER NOT NULL DEFAULT 0 CHECK(ultima_plancha_trabajada >= 0),
  cortes_totales            INTEGER NOT NULL DEFAULT 0 CHECK(cortes_totales >= 0),

  estado                    TEXT NOT NULL CHECK(estado IN ('en_proceso', 'completado', 'cancelado')),

  es_archivado              INTEGER NOT NULL DEFAULT 0 CHECK(es_archivado IN (0,1)),
  archivado_en              TEXT NULL,

  FOREIGN KEY (registro_turno_id) REFERENCES registro_turno(id),
  FOREIGN KEY (turno_id) REFERENCES turno(id),
  FOREIGN KEY (tipo_plancha_id) REFERENCES tipo_plancha(id)
);

CREATE INDEX IF NOT EXISTS ix_pedido_fecha      ON pedido (fecha_registro);
CREATE INDEX IF NOT EXISTS ix_pedido_estado     ON pedido (estado);
CREATE INDEX IF NOT EXISTS ix_pedido_archivado  ON pedido (es_archivado);
CREATE INDEX IF NOT EXISTS ix_pedido_codigo     ON pedido (codigo_producto);
CREATE INDEX IF NOT EXISTS ix_pedido_turno      ON pedido (turno_id);

-- =========================
-- 4) Anomalía
-- =========================

CREATE TABLE IF NOT EXISTS anomalia (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_turno_id       INTEGER NOT NULL,
  turno_id                INTEGER NOT NULL,

  fecha_registro          TEXT NOT NULL DEFAULT (date('now')),
  creado_en               TEXT NOT NULL DEFAULT (datetime('now')),
  modificado_en           TEXT NULL DEFAULT (datetime('now')),

  maquina_id              INTEGER NOT NULL,

  titulo                  TEXT NOT NULL CHECK(length(trim(titulo)) >= 2),
  descripcion             TEXT NOT NULL CHECK(length(trim(descripcion)) >= 10),

  estado                  TEXT NOT NULL CHECK(estado IN ('en_revision', 'solucionado')),
  solucion                TEXT NULL,

  es_archivado            INTEGER NOT NULL DEFAULT 0 CHECK(es_archivado IN (0,1)),
  archivado_en            TEXT NULL,

  CHECK(
    (estado = 'en_revision' AND (solucion IS NULL OR length(trim(solucion)) = 0))
    OR
    (estado = 'solucionado' AND solucion IS NOT NULL AND length(trim(solucion)) >= 10)
  ),

  FOREIGN KEY (registro_turno_id) REFERENCES registro_turno(id),
  FOREIGN KEY (turno_id) REFERENCES turno(id),
  FOREIGN KEY (maquina_id) REFERENCES maquina(id)
);

CREATE INDEX IF NOT EXISTS ix_anomalia_fecha      ON anomalia (fecha_registro);
CREATE INDEX IF NOT EXISTS ix_anomalia_estado     ON anomalia (estado);
CREATE INDEX IF NOT EXISTS ix_anomalia_archivado  ON anomalia (es_archivado);
CREATE INDEX IF NOT EXISTS ix_anomalia_maquina    ON anomalia (maquina_id);
CREATE INDEX IF NOT EXISTS ix_anomalia_turno      ON anomalia (turno_id);

-- =========================
-- 5) Log administrativo
-- =========================

CREATE TABLE IF NOT EXISTS log_admin (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_turno_id INTEGER NOT NULL,

  creado_en         TEXT NOT NULL DEFAULT (datetime('now')),

  accion            TEXT NOT NULL CHECK(length(trim(accion)) >= 3),
  entidad           TEXT NOT NULL CHECK(length(trim(entidad)) >= 3),

  entidad_id        INTEGER NULL,
  detalle           TEXT NULL,

  FOREIGN KEY (registro_turno_id) REFERENCES registro_turno(id)
);

CREATE INDEX IF NOT EXISTS ix_log_admin_fecha
ON log_admin (creado_en);

CREATE INDEX IF NOT EXISTS ix_log_admin_entidad
ON log_admin (entidad, entidad_id);

-- =========================
-- 6) Log de planchas trabajadas (delta) por pedido
-- =========================

CREATE TABLE IF NOT EXISTS pedido_planchas_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,

  pedido_id         INTEGER NOT NULL,
  registro_turno_id INTEGER NOT NULL,
  turno_id          INTEGER NOT NULL,

  fecha_registro    TEXT NOT NULL DEFAULT (date('now')),

  delta_planchas    INTEGER NOT NULL CHECK(delta_planchas >= 0),

  ultima_antes      INTEGER NOT NULL CHECK(ultima_antes >= 0),
  ultima_nueva      INTEGER NOT NULL CHECK(ultima_nueva >= 0),

  creado_en         TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (pedido_id) REFERENCES pedido(id),
  FOREIGN KEY (registro_turno_id) REFERENCES registro_turno(id),
  FOREIGN KEY (turno_id) REFERENCES turno(id)
);

CREATE INDEX IF NOT EXISTS ix_ppl_fecha       ON pedido_planchas_log (fecha_registro);
CREATE INDEX IF NOT EXISTS ix_ppl_turno_fecha ON pedido_planchas_log (turno_id, fecha_registro);
CREATE INDEX IF NOT EXISTS ix_ppl_pedido      ON pedido_planchas_log (pedido_id);

-- =========================
-- 7) Relación Material (tipo_plancha) <-> Variación (variacion_material)
-- =========================
CREATE TABLE IF NOT EXISTS tipo_plancha_variacion (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_plancha_id      INTEGER NOT NULL,
  variacion_material_id INTEGER NOT NULL,

  creado_en            TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(tipo_plancha_id, variacion_material_id),

  FOREIGN KEY (tipo_plancha_id) REFERENCES tipo_plancha(id),
  FOREIGN KEY (variacion_material_id) REFERENCES variacion_material(id)
);

CREATE INDEX IF NOT EXISTS ix_tpv_tipo
ON tipo_plancha_variacion (tipo_plancha_id);

CREATE INDEX IF NOT EXISTS ix_tpv_variacion
ON tipo_plancha_variacion (variacion_material_id);
