-- Tablas para Mi Tienda (MySQL / MariaDB / TiDB)
-- Ejecutar sobre la base de datos ya creada (o elegida en el servicio en la nube).

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    categoria VARCHAR(80) NOT NULL DEFAULT 'General',
    -- Guarda el nombre del archivo, o la URL completa si pasás a Cloudinary
    imagen VARCHAR(500) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
