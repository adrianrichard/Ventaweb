const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const db = require('./db');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Render (y otros hostings) funcionan detrás de un proxy: necesario para las cookies de sesión
app.set('trust proxy', 1);

// 1. Middlewares para parsear el cuerpo de las peticiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Configuración de sesiones
app.use(session({
    // Definí SESSION_SECRET en las variables de entorno de Render
    secret: process.env.SESSION_SECRET || 'clave_solo_para_desarrollo_local',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 2, // Expira en 2 horas
        httpOnly: true,
        sameSite: 'lax',
        secure: 'auto' // cookie segura automáticamente cuando la conexión es HTTPS
    }
}));

// 3. Subida de imágenes con Multer (en memoria; luego se procesa con sharp y se guarda en la BD)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // máximo 5 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true);
        cb(new Error('Solo se permiten archivos de imagen.'));
    }
});

// Reduce la imagen y la convierte a JPG (queda de unos pocos KB)
function procesarImagen(buffer) {
    return sharp(buffer)
        .rotate() // respeta la orientación de fotos tomadas con el celular
        .resize({ height: 900, fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
}

// 4. Archivos estáticos: solo la carpeta public (no se expone la raíz del proyecto)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Middleware para proteger rutas que requieren permisos de Administrador
function verificarAdmin(req, res, next) {
    if (req.session && req.session.esAdmin) {
        return next();
    }
    return res.status(401).json({ mensaje: 'No autorizado. Debe iniciar sesión.' });
}

// ==========================================
// RUTAS PARA SERVIR PÁGINAS HTML (DESDE LA RAÍZ)
// ==========================================

app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get(['/login', '/login.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', (req, res) => {
    if (req.session && req.session.esAdmin) {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.redirect('/login');
    }
});

// Evita entrar al panel saltándose la verificación
app.get('/admin.html', (req, res) => {
    res.redirect('/admin');
});

// Servir favicon directamente desde la carpeta public
app.use('/favicon.ico', express.static(path.join(__dirname, 'public/favicon.ico')));

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Iniciar sesión
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [filas] = await db.query('SELECT * FROM usuarios WHERE username = ?', [username]);

        if (filas.length === 0) {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
        }

        const usuario = filas[0];
        const match = await bcrypt.compare(password, usuario.password);

        if (match) {
            req.session.esAdmin = true;
            req.session.usuarioId = usuario.id;
            return res.json({ mensaje: 'Inicio de sesión exitoso.' });
        } else {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});

// Cerrar sesión
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ mensaje: 'Error al cerrar sesión.' });
        res.clearCookie('connect.sid');
        res.json({ mensaje: 'Sesión cerrada correctamente.' });
    });
});

// ==========================================
// RUTAS DE PRODUCTOS (API CRUD)
// ==========================================

// Obtener todos los productos (Acceso Público). No incluye los bytes de la imagen.
app.get('/api/productos', async (req, res) => {
    try {
        const [productos] = await db.query(
            'SELECT id, nombre, precio, categoria, actualizado_en FROM productos ORDER BY id DESC'
        );
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ mensaje: 'Error al obtener los productos.' });
    }
});

// Entregar la imagen de un producto (Acceso Público)
app.get('/api/productos/:id/imagen', async (req, res) => {
    try {
        const [filas] = await db.query('SELECT imagen_data FROM productos WHERE id = ?', [req.params.id]);

        if (filas.length === 0 || !filas[0].imagen_data) {
            return res.status(404).end();
        }

        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(filas[0].imagen_data);
    } catch (error) {
        console.error('Error al obtener imagen:', error);
        res.status(500).end();
    }
});

// Agregar un nuevo producto (Protegido por Admin)
app.post('/api/productos', verificarAdmin, upload.single('imagen'), async (req, res) => {
    const { nombre, precio, categoria } = req.body;

    if (!req.file) {
        return res.status(400).json({ mensaje: 'La imagen del producto es obligatoria.' });
    }

    try {
        const imagenBuffer = await procesarImagen(req.file.buffer);

        await db.query(
            'INSERT INTO productos (nombre, precio, categoria, imagen_data) VALUES (?, ?, ?, ?)',
            [nombre, parseFloat(precio), categoria || 'General', imagenBuffer]
        );

        res.status(201).json({ mensaje: 'Producto creado exitosamente.' });
    } catch (error) {
        console.error('Error detallado en el servidor:', error);
        res.status(500).json({ mensaje: 'Error al guardar el producto.' });
    }
});

// Editar un producto existente (Protegido por Admin)
app.put('/api/productos/:id', verificarAdmin, upload.single('imagen'), async (req, res) => {
    const { id } = req.params;
    const { nombre, precio, categoria } = req.body;

    try {
        const [existente] = await db.query('SELECT id FROM productos WHERE id = ?', [id]);
        if (existente.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado.' });
        }

        if (req.file) {
            const imagenBuffer = await procesarImagen(req.file.buffer);
            await db.query(
                'UPDATE productos SET nombre = ?, precio = ?, categoria = ?, imagen_data = ? WHERE id = ?',
                [nombre, parseFloat(precio), categoria || 'General', imagenBuffer, id]
            );
        } else {
            await db.query(
                'UPDATE productos SET nombre = ?, precio = ?, categoria = ? WHERE id = ?',
                [nombre, parseFloat(precio), categoria || 'General', id]
            );
        }

        res.json({ mensaje: 'Producto actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ mensaje: 'Error al actualizar el producto.' });
    }
});

// Eliminar un producto (Protegido por Admin)
app.delete('/api/productos/:id', verificarAdmin, async (req, res) => {
    try {
        const [resultado] = await db.query('DELETE FROM productos WHERE id = ?', [req.params.id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado.' });
        }

        res.json({ mensaje: 'Producto eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ mensaje: 'Error al eliminar el producto.' });
    }
});

// Obtener lista de categorías únicas de los productos
app.get('/api/categorias', async (req, res) => {
    try {
        const [filas] = await db.query("SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL AND categoria != '' ORDER BY categoria ASC");
        const categorias = filas.map(f => f.categoria);
        res.json(categorias);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ mensaje: 'Error al obtener categorías' });
    }
});

// Manejo de errores (por ejemplo, imagen demasiado grande): responde siempre en JSON
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    const mensaje = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el máximo de 5 MB.'
        : (err.message || 'Error en la solicitud.');
    res.status(400).json({ mensaje });
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
