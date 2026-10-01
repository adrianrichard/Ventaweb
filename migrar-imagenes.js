// Uso: node migrar-imagenes.js
// Prepara la base de datos para guardar las imágenes dentro de la tabla "productos".
// - Crea las tablas si no existen.
// - Agrega las columnas nuevas solo si faltan (se puede ejecutar más de una vez).

const db = require('./db');

async function columnaExiste(tabla, columna) {
    const [filas] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tabla, columna]
    );
    return filas[0].n > 0;
}

async function main() {
    await db.query(`CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        precio DECIMAL(10,2) NOT NULL,
        categoria VARCHAR(80) NOT NULL DEFAULT 'General',
        imagen VARCHAR(500) NULL,
        imagen_data MEDIUMBLOB NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    if (!(await columnaExiste('productos', 'imagen_data'))) {
        await db.query('ALTER TABLE productos ADD COLUMN imagen_data MEDIUMBLOB NULL');
        console.log('Columna imagen_data agregada.');
    }

    if (!(await columnaExiste('productos', 'actualizado_en'))) {
        await db.query('ALTER TABLE productos ADD COLUMN actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        console.log('Columna actualizado_en agregada.');
    }

    // La columna vieja "imagen" ya no es obligatoria
    await db.query('ALTER TABLE productos MODIFY imagen VARCHAR(500) NULL');

    console.log('Base de datos lista para guardar imágenes.');
    await db.end();
}

main().catch(err => {
    console.error('Error en la migración:', err.message);
    process.exit(1);
});
