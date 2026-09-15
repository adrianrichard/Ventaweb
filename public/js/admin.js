document.addEventListener('DOMContentLoaded', () => {
    cargarProductosAdmin();

    document.getElementById('form-producto').addEventListener('submit', guardarProducto);
    document.getElementById('btn-cancelar').addEventListener('click', limpiarFormulario);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
});

// 1. Cargar productos en la tabla
async function cargarProductosAdmin() {
    const tbody = document.getElementById('tabla-body');

    try {
        const res = await fetch('/api/productos');
        if (res.status === 401) {
            // Si la sesión caducó o no tiene permiso
            window.location.href = 'login.html';
            return;
        }

        const productos = await res.json();
        tbody.innerHTML = '';

        productos.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="/uploads/${p.imagen}" width="60" height="60" style="object-fit:cover;"></td>
                <td>${p.nombre}</td>
                <td>$${p.precio.toFixed(2)}</td>
                <td>
                    <button onclick="prepararEdicion(${p.id}, '${p.nombre}', ${p.precio})" class="btn-edit">Editar</button>
                    <button onclick="eliminarProducto(${p.id})" class="btn-delete">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar tabla admin:', err);
    }
}

// 2. Crear o Editar Producto
async function guardarProducto(e) {
    e.preventDefault();

    const id = document.getElementById('producto-id').value;
    const formData = new FormData(document.getElementById('form-producto'));

    // Si hay un ID, es una edición (PUT), si no, es creación (POST)
    const url = id ? `/api/productos/${id}` : '/api/productos';
    const metodo = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: metodo,
            body: formData // Usamos FormData para enviar texto e imágenes cargadas
        });

        if (res.ok) {
            limpiarFormulario();
            cargarProductosAdmin();
        } else {
            const data = await res.json();
            alert(data.mensaje || 'Error al procesar la solicitud');
        }
    } catch (err) {
        console.error('Error al guardar:', err);
    }
}

// 3. Cargar datos en el formulario para editar
function prepararEdicion(id, nombre, precio) {
    document.getElementById('producto-id').value = id;
    document.getElementById('nombre').value = nombre;
    document.getElementById('precio').value = precio;
    document.getElementById('form-titulo').textContent = 'Editar Producto';
    document.getElementById('btn-guardar').textContent = 'Actualizar Producto';
    document.getElementById('btn-cancelar').style.display = 'inline-block';
}

// 4. Limpiar Formulario
function limpiarFormulario() {
    document.getElementById('form-producto').reset();
    document.getElementById('producto-id').value = '';
    document.getElementById('form-titulo').textContent = 'Agregar Nuevo Producto';
    document.getElementById('btn-guardar').textContent = 'Guardar Producto';
    document.getElementById('btn-cancelar').style.display = 'none';
}

// 5. Eliminar Producto
async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
        const res = await fetch(`/api/productos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            cargarProductosAdmin();
        } else {
            alert('Error al eliminar producto');
        }
    } catch (err) {
        console.error('Error al eliminar:', err);
    }
}

// 6. Cerrar Sesión
async function cerrarSesion() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = 'login.html';
}