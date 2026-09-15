document.addEventListener("DOMContentLoaded", () => {
    cargarProductos();
});

async function cargarProductos() {
    const grid = document.getElementById("productos-grid");

    try {
        // Petición a la API del servidor backend
        const respuesta = await fetch("/api/productos");
        const productos = await respuesta.json();

        grid.innerHTML = ""; // Limpiar mensaje de carga

        if (productos.length === 0) {
            grid.innerHTML = "<p>No hay productos disponibles por el momento.</p>";
            return;
        }

        // Generar las tarjetas HTML por cada producto
        productos.forEach(prod => {
            const card = document.createElement("div");
            card.className = "card-producto";
            card.innerHTML = `
                <img src="/uploads/${prod.imagen}" alt="${prod.nombre}">
                <h3>${prod.nombre}</h3>
                <p class="precio">$${prod.precio.toFixed(2)}</p>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Error al obtener los productos:", error);
        grid.innerHTML = "<p>Error al cargar el catálogo de productos.</p>";
    }
}