// Rutas del carrusel de imágenes de la página principal.
// Se activa en server.js con:  app.use(require('./rutas-carrusel'));

const express = require('express');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const db = require('./db');

const router = express.Router();
const MAX_IMAGENES = 10;

// Crea la tabla automáticamente si todavía no existe
db.query(`CREATE TABLE IF NOT EXISTS carrusel (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imagen_data MEDIUMBLOB NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).catch(err => console.error('No se pudo crear la tabla carrusel:', err.message));

function verificarAdmin(req, res, next) {
    if (req.session && req.session.esAdmin) return next();
    return res.status(401).json({ mensaje: 'No autorizado. Debe iniciar sesión.' });
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true);
        cb(new Error('Solo se permiten archivos de imagen.'));
    }
});

// Ejecuta multer y responde en JSON si hay un error de subida
function subirImagen(req, res, next) {
    upload.single('imagen')(req, res, (err) => {
        if (!err) return next();
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen supera el máximo de 10 MB.'
            : err.message;
        res.status(400).json({ mensaje });
    });
}

// ---------- Páginas ----------

router.get('/admin-carrusel', (req, res) => {
    if (req.session && req.session.esAdmin) {
        res.sendFile(path.join(__dirname, 'admin-carrusel.html'));
    } else {
        res.redirect('/login');
    }
});

router.get('/admin-carrusel.html', (req, res) => res.redirect('/admin-carrusel'));

// ---------- API ----------

// Lista de imágenes (Acceso Público). No incluye los bytes de las fotos.
router.get('/api/carrusel', async (req, res) => {
    try {
        const [filas] = await db.query('SELECT id FROM carrusel ORDER BY id ASC');
        res.json(filas);
    } catch (error) {
        console.error('Error al obtener el carrusel:', error);
        res.status(500).json({ mensaje: 'Error al obtener las imágenes del carrusel.' });
    }
});

// Entregar una imagen (Acceso Público)
router.get('/api/carrusel/:id/imagen', async (req, res) => {
    try {
        const [filas] = await db.query('SELECT imagen_data FROM carrusel WHERE id = ?', [req.params.id]);

        if (filas.length === 0 || !filas[0].imagen_data) {
            return res.status(404).end();
        }

        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(filas[0].imagen_data);
    } catch (error) {
        console.error('Error al obtener imagen del carrusel:', error);
        res.status(500).end();
    }
});

// Agregar una imagen (Protegido por Admin)
router.post('/api/carrusel', verificarAdmin, subirImagen, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ mensaje: 'Seleccioná una imagen.' });
    }

    try {
        const [conteo] = await db.query('SELECT COUNT(*) AS total FROM carrusel');
        if (conteo[0].total >= MAX_IMAGENES) {
            return res.status(400).json({ mensaje: `El carrusel admite como máximo ${MAX_IMAGENES} imágenes. Eliminá alguna para agregar otra.` });
        }

        const imagenBuffer = await sharp(req.file.buffer)
            .rotate() // respeta la orientación de fotos tomadas con el celular
            .resize({ width: 1600, height: 1000, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        await db.query('INSERT INTO carrusel (imagen_data) VALUES (?)', [imagenBuffer]);

        res.status(201).json({ mensaje: 'Imagen agregada al carrusel.' });
    } catch (error) {
        console.error('Error al agregar imagen al carrusel:', error);
        res.status(500).json({ mensaje: 'Error al guardar la imagen.' });
    }
});

// Eliminar una imagen (Protegido por Admin)
router.delete('/api/carrusel/:id', verificarAdmin, async (req, res) => {
    try {
        const [resultado] = await db.query('DELETE FROM carrusel WHERE id = ?', [req.params.id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Imagen no encontrada.' });
        }

        res.json({ mensaje: 'Imagen eliminada.' });
    } catch (error) {
        console.error('Error al eliminar imagen del carrusel:', error);
        res.status(500).json({ mensaje: 'Error al eliminar la imagen.' });
    }
});

module.exports = router;
