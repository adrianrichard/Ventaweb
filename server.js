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

// 1. Middlewares para parsear el cuerpo de las peticiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Configuración de sesiones
app.use(session({
    secret: 'clave_secreta_mi_tienda_123', // Cambia esta frase por una más segura
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // Expira en 2 horas
}));

// 3. Configurar la subida de imágenes con Multer
const storage = multer.memoryStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Genera un nombre único usando timestamp para evitar sobreescritura
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, filename);
    }
});
const upload = multer({ storage });

// 4. Archivos estáticos
// Permite acceder a los archivos estáticos de la carpeta raíz (HTML) y de public (CSS, JS, imágenes)
app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', (req, res) => {
    if (req.session && req.session.esAdmin) {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.redirect('/login');
    }
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
    // 1. Extraer categoria
    const { nombre, precio, categoria } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ mensaje: 'La imagen del producto es obligatoria.' });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const outputPath = path.join(__dirname, 'public/uploads', filename);

    try {
        await sharp(req.file.buffer)
            .resize({ height: 300, fit: 'inside' })
            .jpeg({ quality: 80 })
            .toFile(outputPath);

        // 2. Verificar que la consulta SQL coincida con tus columnas en MariaDB
        await db.query(
            'INSERT INTO productos (nombre, precio, categoria, imagen) VALUES (?, ?, ?, ?)',
            [nombre, parseFloat(precio), categoria || 'General', filename]
        );

        res.status(201).json({ mensaje: 'Producto creado exitosamente.' });
    } catch (error) {
        console.error('Error detallado en el servidor:', error); // Esto mostrará el error exacto en tu terminal
        res.status(500).json({ mensaje: 'Error al guardar el producto.' });
    }
});

// Editar un producto existente (Protegido por Admin)
app.put('/api/productos/:id', verificarAdmin, upload.single('imagen'), async (req, res) => {
    const { id } = req.params;
    // 1. Extraer categoria
    const { nombre, precio, categoria } = req.body;

    try {
        const [productoExistente] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
        if (productoExistente.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado.' });
        }

        let nuevaImagen = productoExistente[0].imagen;

        if (req.file) {
            nuevaImagen = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
            const outputPath = path.join(__dirname, 'public/uploads', nuevaImagen);

            await sharp(req.file.buffer)
                .resize({ height: 300, fit: 'inside' })
                .jpeg({ quality: 80 })
                .toFile(outputPath);

            const rutaAntigua = path.join(__dirname, 'public/uploads', productoExistente[0].imagen);
            if (fs.existsSync(rutaAntigua)) {
                fs.unlinkSync(rutaAntigua);
            }
        }

        // 2. Actualizar el UPDATE con categoria
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
        const rutaImagen = path.join(__dirname, 'public/uploads', filas[0].imagen);
        if (fs.existsSync(rutaImagen)) {
            fs.unlinkSync(rutaImagen);
        }

        // Eliminar el registro en MySQL
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
        const [filas] = await db.query('SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL AND categoria != "" ORDER BY categoria ASC');
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

