// Imagen de reemplazo si un producto no tiene foto
const SIN_IMAGEN = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#e0e0e0"/>' +
    '<text x="50%" y="50%" font-family="Arial" font-size="14" fill="#777" text-anchor="middle">Sin imagen</text></svg>'
);

let todosLosProductos = [];

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

// Minúsculas y sin acentos, para que "camara" encuentre "Cámara"
function normalizar(texto) {
    return (texto ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function llenarFiltroCategorias() {
    const select = document.getElementById('filtro-categoria');
    if (!select) return;

    const seleccionada = select.value;
    const categorias = [...new Set(todosLosProductos.map(p => p.categoria || 'General'))]
        .sort((a, b) => a.localeCompare(b, 'es'));

    select.innerHTML = '<option value="">Todas las categorías</option>';
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });

    if (categorias.includes(seleccionada)) select.value = seleccionada;
}

function renderizarProductos() {
    const gridProductos = document.getElementById('productos-grid');
    if (!gridProductos) return;

    const buscador = document.getElementById('buscador');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const texto = normalizar(buscador ? buscador.value.trim() : '');
    const categoria = filtroCategoria ? filtroCategoria.value : '';

    gridProductos.innerHTML = '';

    if (todosLosProductos.length === 0) {
        gridProductos.innerHTML = '<p>No hay productos disponibles por el momento.</p>';
        return;
    }

    const filtrados = todosLosProductos.filter(p =>
        normalizar(p.nombre).includes(texto) &&
        (categoria === '' || (p.categoria || 'General') === categoria)
    );

    if (filtrados.length === 0) {
        gridProductos.innerHTML = '<p class="sin-resultados">No se encontraron productos con ese criterio.</p>';
        return;
    }

    filtrados.forEach(prod => {
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

        todosLosProductos = productos;
        llenarFiltroCategorias();
        renderizarProductos();

    } catch (err) {
        console.error('Error al obtener los productos:', err);
        gridProductos.innerHTML = `<p class="error-msg">Error al cargar productos: ${escaparHtml(err.message)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();

    const buscador = document.getElementById('buscador');
    const filtroCategoria = document.getElementById('filtro-categoria');

    if (buscador) buscador.addEventListener('input', renderizarProductos);
    if (filtroCategoria) filtroCategoria.addEventListener('change', renderizarProductos);
});
