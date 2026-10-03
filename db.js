const fs = require('fs');
const mysql = require('mysql2/promise');

// Configuración del pool a partir de variables de entorno
const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tu_base_de_datos',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// TiDB Cloud, Aiven y otros servicios en la nube exigen conexión SSL.
// En Render definí DB_SSL=true. En local no hace falta.
if (process.env.DB_SSL === 'true') {
    config.ssl = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    };

    // Aiven entrega un certificado CA. Dos formas de indicarlo:
    // - DB_SSL_CA_FILE: ruta a un archivo (cómodo en tu PC, ej. ./ca.pem)
    // - DB_SSL_CA: el contenido completo del certificado (cómodo en Render)
    if (process.env.DB_SSL_CA_FILE) {
        config.ssl.ca = fs.readFileSync(process.env.DB_SSL_CA_FILE);
    } else if (process.env.DB_SSL_CA) {
        config.ssl.ca = process.env.DB_SSL_CA;
    }
}

const db = mysql.createPool(config);

// Prueba de conexión al iniciar (solo informa, no detiene el servidor)
db.getConnection()
    .then(conn => {
        console.log('Conexión a la base de datos exitosa.');
        conn.release();
    })
    .catch(err => {
        console.error('No se pudo conectar a la base de datos:', err.message);
    });

module.exports = db;
