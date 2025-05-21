-- Creación de la tabla 'profesor'
CREATE TABLE profesor (
    id VARCHAR(50) PRIMARY KEY, -- O INT AUTO_INCREMENT si es un ID numérico autoincremental
    nombre VARCHAR(255) NOT NULL,
    horas_segun_contrato VARCHAR(50), -- Podría ser INT si es un número de horas
    estado VARCHAR(50),
    fecha_registro DATE,
    fecha_modificacion DATE
);

-- Creación de la tabla 'asistencia'
CREATE TABLE asistencia (
    id VARCHAR(50) PRIMARY KEY, -- O INT AUTO_INCREMENT
    id_profesor VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    horas TIME, -- Cambiado de DATE a TIME, es más probable que sea una hora específica
    tardanza VARCHAR(50),
    justificacion TEXT,
    estado VARCHAR(50),
    fecha_registro DATE,
    fecha_modificacion DATE,
    FOREIGN KEY (id_profesor) REFERENCES profesor(id)
);

-- Creación de la tabla 'feriados'
CREATE TABLE feriados (
    id VARCHAR(50) PRIMARY KEY, -- O INT AUTO_INCREMENT
    fecha DATE NOT NULL,
    descripcion TEXT,
    estado VARCHAR(50),
    fecha_registro DATE,
    fecha_modificacion DATE
);

-- Creación de la tabla 'horario'
CREATE TABLE horario (
    id VARCHAR(50) PRIMARY KEY, -- O INT AUTO_INCREMENT
    id_profesor VARCHAR(50) NOT NULL,
    hora_entrada TIME, -- Cambiado de DATE a TIME
    hora_salida TIME,   -- Cambiado de DATE a TIME
    estado VARCHAR(50),
    fecha_registro DATE,
    fecha_modificacion DATE,
    FOREIGN KEY (id_profesor) REFERENCES profesor(id)
);

-- NOTA: Si quieres que 'id' sea un número entero autoincremental, el código para profesor sería:
-- CREATE TABLE profesor (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     nombre VARCHAR(255) NOT NULL,
--     horas_segun_contrato INT, -- Si es un número
--     estado VARCHAR(50),
--     fecha_registro DATE,
--     fecha_modificacion DATE
-- );
-- Y los 'id_profesor' en asistencia y horario también serían INT.