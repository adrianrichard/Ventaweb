document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar vistas y eventos
    cargarCategoriasEnSelect();
    cargarProductosAdmin();

    const selectCategoria = document.getElementById('select-categoria');
    const nuevaCategoriaInput = document.getElementById('nueva-categoria-input');
    const formProducto = document.getElementById('form-producto');
    const btnCancelar = document.getElementById('btn-cancelar');
    const btnLogout = document.getElementById('btn-logout');

    // Evento para mostrar/ocultar input de nueva categoría
    if (selectCategoria && nuevaCategoriaInput) {
        selectCategoria.addEventListener('change', () => {
            if (selectCategoria.value === '__NUEVA__') {
                nuevaCategoriaInput.style.display = 'block';
                nuevaCategoriaInput.setAttribute('required', 'true');
                nuevaCategoriaInput.focus();
            } else {
                nuevaCategoriaInput.style.display = 'none';
                nuevaCategoriaInput.removeAttribute('required');
                nuevaCategoriaInput.value = '';
            }
        });
    }

    if (formProducto) formProducto.addEventListener('submit', guardarProducto);
    if (btnCancelar) btnCancelar.addEventListener('click', limpiarFormulario);
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
});

// Cargar categorías en el <select>
async function cargarCategoriasEnSelect() {
    const selectCategoria = document.getElementById('select-categoria');
    if (!selectCategoria) return;

    try {
        const res = await fetch('/api/categorias');
        let categorias = [];
        if (res.ok) {
            categorias = await res.json();
        }

        const categoriasBase = new Set(['Calzados', 'Indumentaria', 'Electrónica', 'Hogar', ...categorias]);

        selectCategoria.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
        
        categoriasBase.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });

        const optionNueva = document.createElement('option');
        optionNueva.value = '__NUEVA__';
        optionNueva.textContent = '➕ Nueva categoría...';
        selectCategoria.appendChild(optionNueva);
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}

// Cargar productos en la tabla
async function cargarProductosAdmin() {
    const tbody = document.getElementById('tabla-body');
    if (!tbody) return;

    try {
        const res = await fetch('/api/productos');
        if (res.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        const productos = await res.json();
        tbody.innerHTML = '';

        productos.forEach(p => {
            const tr = document.createElement('tr');
            // Sanitizar valores para evitar romper la sintaxis en la llamada inline
            const pNombreEscaped = p.nombre.replace(/'/g, "\\'");
            const pCatEscaped = (p.categoria || 'General').replace(/'/g, "\\'");

            tr.innerHTML = `
                <td><img src="/uploads/${p.imagen}" width="60" height="60" style="object-fit:cover; border-radius:4px;"></td>
                <td>${p.nombre}</td>
                <td>$${parseFloat(p.precio).toFixed(2)}</td>
                <td>${p.categoria || 'General'}</td>
                <td>
                    <button onclick="prepararEdicion(${p.id}, '${pNombreEscaped}', ${p.precio}, '${pCatEscaped}')" class="btn-edit">Editar</button>
                    <button onclick="eliminarProducto(${p.id})" class="btn-delete">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar tabla admin:', err);
    }
}

// Crear o Editar Producto
async function guardarProducto(e) {
    e.preventDefault();

    const id = document.getElementById('producto-id').value;
    const nombre = document.getElementById('nombre').value;
    const precio = document.getElementById('precio').value;
    const selectCategoria = document.getElementById('select-categoria');
    const nuevaCategoriaInput = document.getElementById('nueva-categoria-input');
    const fileInput = document.getElementById('imagen');

    let categoriaFinal = selectCategoria.value;
    if (categoriaFinal === '__NUEVA__') {
        categoriaFinal = nuevaCategoriaInput.value.trim();
    }

    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('precio', precio);
    formData.append('categoria', categoriaFinal);

    if (fileInput.files[0]) {
        formData.append('imagen', fileInput.files[0]);
    }

    const url = id ? `/api/productos/${id}` : '/api/productos';
    const metodo = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: metodo,
            body: formData
        });

        if (res.ok) {
            limpiarFormulario();
            await cargarCategoriasEnSelect();
            cargarProductosAdmin();
        } else {
            const data = await res.json();
            alert(data.mensaje || 'Error al procesar la solicitud');
        }
    } catch (err) {
        console.error('Error al guardar:', err);
    }
}

// Prepara el formulario para editar
function prepararEdicion(id, nombre, precio, categoria) {
    document.getElementById('producto-id').value = id;
    document.getElementById('nombre').value = nombre;
    document.getElementById('precio').value = precio;

    const selectCategoria = document.getElementById('select-categoria');
    const nuevaCategoriaInput = document.getElementById('nueva-categoria-input');

    const existeOpcion = Array.from(selectCategoria.options).some(op => op.value === categoria);

    if (existeOpcion) {
        selectCategoria.value = categoria;
        nuevaCategoriaInput.style.display = 'none';
        nuevaCategoriaInput.removeAttribute('required');
    } else {
        selectCategoria.value = '__NUEVA__';
        nuevaCategoriaInput.style.display = 'block';
        nuevaCategoriaInput.value = categoria;
    }

    document.getElementById('form-titulo').textContent = 'Editar Producto';
    document.getElementById('btn-guardar').textContent = 'Actualizar Producto';
    document.getElementById('btn-cancelar').style.display = 'inline-block';
}

// Limpiar Formulario
function limpiarFormulario() {
    document.getElementById('form-producto').reset();
    document.getElementById('producto-id').value = '';
    
    const nuevaCategoriaInput = document.getElementById('nueva-categoria-input');
    if (nuevaCategoriaInput) {
        nuevaCategoriaInput.style.display = 'none';
        nuevaCategoriaInput.removeAttribute('required');
    }

    document.getElementById('form-titulo').textContent = 'Agregar Nuevo Producto';
    document.getElementById('btn-guardar').textContent = 'Guardar Producto';
    document.getElementById('btn-cancelar').style.display = 'none';
}

// Eliminar Producto
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

// Cerrar Sesión
async function cerrarSesion() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = 'login.html';
}