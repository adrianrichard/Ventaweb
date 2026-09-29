document.addEventListener("DOMContentLoaded", () => {
    cargarProductos();
});

async function cargarProductos() {
    const gridProductos = document.getElementById('productos-grid');
    if (!gridProductos) return;

    try {
        const res = await fetch('/api/productos');

        // Validar si el servidor respondió con un error (ej. 500)
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.mensaje || `Error del servidor (${res.status})`);
        }

        const productos = await res.json();

        // Verificar que la respuesta sea un arreglo antes de iterar
        if (!Array.isArray(productos)) {
            throw new TypeError("El servidor no devolvió una lista de productos válida.");
        }

        gridProductos.innerHTML = '';

        if (productos.length === 0) {
            gridProductos.innerHTML = '<p>No hay productos disponibles por el momento.</p>';
            return;
        }

        productos.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'card-producto';
            
            card.innerHTML = `
                <img src="/uploads/${prod.imagen}" alt="${prod.nombre}">
                <h3>${prod.nombre}</h3>
                <span class="badge-categoria">${prod.categoria || 'General'}</span>
                <p class="precio">$${parseFloat(prod.precio).toFixed(2)}</p>
            `;
            
            gridProductos.appendChild(card);
        });

    } catch (err) {
        console.error('Error al obtener los productos:', err);
        gridProductos.innerHTML = `<p class="error-msg">Error al cargar productos: ${err.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', cargarProductos);