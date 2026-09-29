// Uso: node crear-admin.js <usuario> <contraseña>
// Crea el administrador, o actualiza su contraseña si el usuario ya existe.

const bcrypt = require('bcryptjs');
const db = require('./db');

async function main() {
    const [username, password] = process.argv.slice(2);

    if (!username || !password) {
        console.log('Uso: node crear-admin.js <usuario> <contraseña>');
        process.exit(1);
    }

    if (password.length < 8) {
        console.log('La contraseña debe tener al menos 8 caracteres.');
        process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);

    const [existente] = await db.query('SELECT id FROM usuarios WHERE username = ?', [username]);

    if (existente.length > 0) {
        await db.query('UPDATE usuarios SET password = ? WHERE username = ?', [hash, username]);
        console.log(`Contraseña actualizada para el usuario "${username}".`);
    } else {
        await db.query('INSERT INTO usuarios (username, password) VALUES (?, ?)', [username, hash]);
        console.log(`Usuario admin "${username}" creado.`);
    }

    await db.end();
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
