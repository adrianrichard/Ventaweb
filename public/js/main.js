// Imagen de reemplazo si un producto no tiene foto
const SIN_IMAGEN = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#e0e0e0"/>' +
    '<text x="50%" y="50%" font-family="Arial" font-size="14" fill="#777" text-anchor="middle">Sin imagen</text></svg>'
);

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

async function cargarProductos() {
    const gridProductos = document.getElementById('productos-grid');
    if (!gridProductos) return;

    try {
        const res = await fetch('/api/productos');

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.mensaje || `Error del servidor (${res.status})`);
        }

        const productos = await res.json();

        if (!Array.isArray(productos)) {
            throw new TypeError('El servidor no devolvió una lista de productos válida.');
        }

        gridProductos.innerHTML = '';

        if (productos.length === 0) {
            gridProductos.innerHTML = '<p>No hay productos disponibles por el momento.</p>';
            return;
        }

        productos.forEach(prod => {
            // "v" cambia cuando se edita el producto, para que el navegador no use una imagen vieja
            const version = new Date(prod.actualizado_en).getTime() || 0;

            const card = document.createElement('div');
            card.className = 'card-producto';

            card.innerHTML = `
                <img src="/api/productos/${prod.id}/imagen?v=${version}" alt="${escaparHtml(prod.nombre)}">
                <h3>${escaparHtml(prod.nombre)}</h3>
                <p class="precio">$${parseFloat(prod.precio).toFixed(2)}</p>
            `;

            card.querySelector('img').addEventListener('error', (e) => {
                e.target.src = SIN_IMAGEN;
            }, { once: true });

            gridProductos.appendChild(card);
        });

    } catch (err) {
        console.error('Error al obtener los productos:', err);
        gridProductos.innerHTML = `<p class="error-msg">Error al cargar productos: ${escaparHtml(err.message)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', cargarProductos);
