const MAX_IMAGENES = 10;

document.addEventListener('DOMContentLoaded', () => {
    cargarCarrusel();

    document.getElementById('form-carrusel').addEventListener('submit', subirImagen);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

    // Botones "Eliminar" (delegación de eventos)
    document.getElementById('lista-carrusel').addEventListener('click', (e) => {
        const boton = e.target.closest('button[data-id]');
        if (boton) eliminarImagen(boton.dataset.id);
    });
});

function mostrarMensaje(texto, tipo = 'exito') {
    const p = document.getElementById('mensaje');
    p.textContent = texto;
    p.className = `mensaje mensaje-${tipo}`;
}

async function cargarCarrusel() {
    const lista = document.getElementById('lista-carrusel');
    const input = document.getElementById('imagen-carrusel');
    const btnSubir = document.getElementById('btn-subir');

    try {
        const res = await fetch('/api/carrusel');
        if (!res.ok) throw new Error(`Error del servidor (${res.status})`);

        const imagenes = await res.json();
        lista.innerHTML = '';

        if (imagenes.length === 0) {
            lista.innerHTML = '<p class="sin-resultados">Todavía no hay imágenes en el carrusel.</p>';
        }

        imagenes.forEach((imagen, i) => {
            const item = document.createElement('div');
            item.className = 'carrusel-admin-item';

            const img = document.createElement('img');
            img.src = `/api/carrusel/${imagen.id}/imagen`;
            img.alt = `Imagen ${i + 1} del carrusel`;

            const btn = document.createElement('button');
            btn.className = 'btn-delete';
            btn.textContent = 'Eliminar';
            btn.dataset.id = imagen.id;

            item.append(img, btn);
            lista.appendChild(item);
        });

        document.getElementById('contador').textContent = `${imagenes.length} de ${MAX_IMAGENES}`;

        // Al llegar al máximo, se bloquea la subida
        const lleno = imagenes.length >= MAX_IMAGENES;
        input.disabled = lleno;
        btnSubir.disabled = lleno;
        if (lleno) {
            mostrarMensaje('Llegaste al máximo de 10 imágenes. Eliminá alguna para agregar otra.', 'error');
        }
    } catch (err) {
        console.error('Error al cargar el carrusel:', err);
        lista.innerHTML = '<p class="error-msg">Error al cargar las imágenes.</p>';
    }
}

async function subirImagen(e) {
    e.preventDefault();

    const input = document.getElementById('imagen-carrusel');
    const btnSubir = document.getElementById('btn-subir');

    if (!input.files[0]) {
        mostrarMensaje('Seleccioná una imagen.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('imagen', input.files[0]);

    btnSubir.disabled = true;
    btnSubir.textContent = 'Subiendo...';

    try {
        const res = await fetch('/api/carrusel', { method: 'POST', body: formData });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            document.getElementById('form-carrusel').reset();
            mostrarMensaje('Imagen agregada al carrusel.');
        } else {
            mostrarMensaje(data.mensaje || 'No se pudo subir la imagen.', 'error');
        }
    } catch (err) {
        console.error('Error al subir imagen:', err);
        mostrarMensaje('Error de conexión con el servidor.', 'error');
    } finally {
        btnSubir.textContent = 'Subir imagen';
        await cargarCarrusel(); // vuelve a habilitar o bloquea el formulario según el total
    }
}

async function eliminarImagen(id) {
    if (!confirm('¿Eliminar esta imagen del carrusel?')) return;

    try {
        const res = await fetch(`/api/carrusel/${id}`, { method: 'DELETE' });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (res.ok) {
            mostrarMensaje('Imagen eliminada.');
            cargarCarrusel();
        } else {
            mostrarMensaje('No se pudo eliminar la imagen.', 'error');
        }
    } catch (err) {
        console.error('Error al eliminar imagen:', err);
        mostrarMensaje('Error de conexión con el servidor.', 'error');
    }
}

async function cerrarSesion() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
}
