const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Render (y otros hostings) funcionan detrás de un proxy: necesario para las cookies de sesión
app.set('trust proxy', 1);

// Asegurar que exista la carpeta de imágenes (en Render no viene en el repo si está vacía)
const uploadsDir = path.join(__dirname, 'public/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

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
        secure: 'auto' // usa cookie segura automáticamente cuando la conexión es HTTPS
    }
}));

// 3. Configurar la subida de imágenes con Multer (en memoria, luego se procesa con sharp)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // máximo 5 MB
});

// 4. Archivos estáticos: solo la carpeta public (ya NO se expone la raíz del proyecto)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

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

// Obtener todos los productos (Acceso Público)
app.get('/api/productos', async (req, res) => {
    try {
        const [productos] = await db.query('SELECT * FROM productos ORDER BY id DESC');
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ mensaje: 'Error al obtener los productos.' });
    }
});

// Agregar un nuevo producto (Protegido por Admin)
app.post('/api/productos', verificarAdmin, upload.single('imagen'), async (req, res) => {
    const { nombre, precio, categoria } = req.body;

    if (!req.file) {
        return res.status(400).json({ mensaje: 'La imagen del producto es obligatoria.' });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const outputPath = path.join(uploadsDir, filename);

    try {
        await sharp(req.file.buffer)
            .resize({ height: 300, fit: 'inside' })
            .jpeg({ quality: 80 })
            .toFile(outputPath);

        await db.query(
            'INSERT INTO productos (nombre, precio, categoria, imagen) VALUES (?, ?, ?, ?)',
            [nombre, parseFloat(precio), categoria || 'General', filename]
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
        const [productoExistente] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
        if (productoExistente.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado.' });
        }

        let nuevaImagen = productoExistente[0].imagen;

        if (req.file) {
            nuevaImagen = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
            const outputPath = path.join(uploadsDir, nuevaImagen);

            await sharp(req.file.buffer)
                .resize({ height: 300, fit: 'inside' })
                .jpeg({ quality: 80 })
                .toFile(outputPath);

            const rutaAntigua = path.join(uploadsDir, productoExistente[0].imagen);
            if (fs.existsSync(rutaAntigua)) {
                fs.unlinkSync(rutaAntigua);
            }
        }

        await db.query(
            'UPDATE productos SET nombre = ?, precio = ?, categoria = ?, imagen = ? WHERE id = ?',
            [nombre, parseFloat(precio), categoria || 'General', nuevaImagen, id]
        );

        res.json({ mensaje: 'Producto actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ mensaje: 'Error al actualizar el producto.' });
    }
});

// Eliminar un producto (Protegido por Admin)
app.delete('/api/productos/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const [filas] = await db.query('SELECT imagen FROM productos WHERE id = ?', [id]);
        if (filas.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado.' });
        }

        // Eliminar la imagen física guardada en la carpeta uploads
        const rutaImagen = path.join(uploadsDir, filas[0].imagen);
        if (fs.existsSync(rutaImagen)) {
            fs.unlinkSync(rutaImagen);
        }

        await db.query('DELETE FROM productos WHERE id = ?', [id]);

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

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
