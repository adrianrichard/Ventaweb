const bcrypt = require('bcryptjs');
const db = require('./db');

async function crearAdmin() {
    const username = 'admin';       // Puedes cambiar este usuario
    const passwordPlana = 'admin123'; // Puedes cambiar esta contraseña

    try {
        // Encriptar la contraseña con salt 10
        const hashedPassword = await bcrypt.hash(passwordPlana, 10);

        await db.query(
            'INSERT INTO usuarios (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );

        console.log(`✅ Administrador '${username}' creado correctamente.`);
        process.exit();
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️ El usuario '${username}' ya existe.`);
        } else {
            console.error('Error al crear el administrador:', error);
        }
        process.exit(1);
    }
}

crearAdmin();