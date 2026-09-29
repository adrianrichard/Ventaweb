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

    // Aiven entrega un certificado CA: pegá su contenido en DB_SSL_CA
    if (process.env.DB_SSL_CA) {
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
