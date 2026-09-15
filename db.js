const mysql = require('mysql2/promise');

// Configuración de la conexión a MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // Cambia según tu usuario de MySQL
    password: '',      // Cambia según tu contraseña de MySQL
    database: 'mi_tienda',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;