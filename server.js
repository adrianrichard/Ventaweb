const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares de análisis de cuerpo y sesión
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'clave_secreta_mi_tienda_123', // Cambia esto por una frase segura
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // La sesión expira en 2 horas
}));

// 2. Configurar la subida de imágenes con Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Renombrar imagen para evitar duplicados usando timestamp
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, filename);
    }
});
const upload = multer({ storage });

// 3. Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para proteger rutas de administración
function verificarAdmin(req, res, next) {
    if (req.session && req.session.esAdmin) {
        return next();
    }
    return res.status(401).json({ mensaje: 'No autorizado. Debe iniciar sesión.' });
}

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Login de Administrador
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
        console.error(error);
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
// RUTAS DE PRODUCTOS (CRUD)
// ==========================================

// Obtener todos los productos (Público)
app.get('/api/productos', async (req, res) => {
    try {
        const [productos] = await db.query('SELECT * FROM productos ORDER BY id DESC');
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener los productos.' });
    }
});

// Agregar un producto (Protegido por Admin)
app.post('/api/productos', verificarAdmin, upload.single('imagen'), async (req, res) => {
    const { nombre, precio } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ mensaje: 'La imagen del producto es obligatoria.' });
    }

    const imagen = req.file.filename;

    try {
        await db.query(
            'INSERT INTO productos (nombre, precio, imagen) VALUES (?, ?, ?)',
            [nombre, parseFloat(precio), imagen]
        );
        res.status(201).json({ mensaje: 'Producto creado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al guardar el producto.' });
    }
});

// Editar un producto (Protegido por Admin)
app.put('/api/productos/:id', verificarAdmin, upload.single('imagen'), async (req, res) => {
    const { id } = req.params;
    const { nombre, precio } = req.body;

    try {
        const [productoExistente] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
        if (productoExistente.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado.' });
        }

        let nuevaImagen = productoExistente[0].imagen;

        // Si se sube una nueva imagen, se borra la anterior del disco
        if (req.file) {
            nuevaImagen = req.file.filename;
            const rutaAntigua = path.join(__dirname, 'public/uploads', productoExistente[0].imagen);
            if (fs.existsSync(rutaAntigua)) {
                fs.unlinkSync(rutaAntigua);
            }
        }

        await db.query(
            'UPDATE productos SET nombre = ?, precio = ?, imagen = ? WHERE id = ?',
            [nombre, parseFloat(precio), nuevaImagen, id]
        );

        res.json({ mensaje: 'Producto actualizado exitosamente.' });
    } catch (error) {
        console.error(error);
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

        // Eliminar la imagen asociada
        const rutaImagen = path.join(__dirname, 'public/uploads', filas[0].imagen);
        if (fs.existsSync(rutaImagen)) {
            fs.unlinkSync(rutaImagen);
        }

        // Eliminar registro de la base de datos
        await db.query('DELETE FROM productos WHERE id = ?', [id]);

        res.json({ mensaje: 'Producto eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar el producto.' });
    }
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});