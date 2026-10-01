// Uso: node crear-tablas.js
// Crea las tablas "usuarios" y "productos" en la base configurada por las variables de entorno DB_*.
// Es seguro ejecutarlo más de una vez (usa IF NOT EXISTS).

const db = require('./db');

const tablas = [
    `CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        precio DECIMAL(10,2) NOT NULL,
        categoria VARCHAR(80) NOT NULL DEFAULT 'General',
        imagen VARCHAR(500) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
];

async function main() {
    for (const sql of tablas) {
        await db.query(sql);
    }
    console.log('Tablas "usuarios" y "productos" listas.');
    await db.end();
}

main().catch(err => {
    console.error('Error al crear las tablas:', err.message);
    process.exit(1);
});
