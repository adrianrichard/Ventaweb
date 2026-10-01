const SIN_IMAGEN = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="100%" height="100%" fill="#e0e0e0"/></svg>'
);

document.addEventListener('DOMContentLoaded', () => {
    cargarCategoriasEnSelect();
    cargarProductosAdmin();

    const selectCategoria = document.getElementById('select-categoria');
    const nuevaCategoriaInput = document.getElementById('nueva-categoria-input');
    const formProducto = document.getElementById('form-producto');
    const btnCancelar = document.getElementById('btn-cancelar');
    const btnLogout = document.getElementById('btn-logout');
    const tablaBody = document.getElementById('tabla-body');

    // Mostrar/ocultar input de nueva categoría
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

    // Botones Editar / Eliminar de la tabla (delegación de eventos)
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            const boton = e.target.closest('button[data-accion]');
            if (!boton) return;

            if (boton.dataset.accion === 'editar') {
                prepararEdicion(
                    boton.dataset.id,
                    boton.dataset.nombre,
                    boton.dataset.precio,
                    boton.dataset.categoria
                );
            } else if (boton.dataset.accion === 'eliminar') {
                eliminarProducto(boton.dataset.id);
            }
        });
    }
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
        if (!res.ok) throw new Error(`Error del servidor (${res.status})`);

        const productos = await res.json();
        tbody.innerHTML = '';

        productos.forEach(p => {
            const version = new Date(p.actualizado_en).getTime() || 0;
            const categoria = p.categoria || 'General';
            const tr = document.createElement('tr');

            // Imagen
            const tdImg = document.createElement('td');
            const img = document.createElement('img');
            img.src = `/api/productos/${p.id}/imagen?v=${version}`;
            img.width = 60;
            img.height = 60;
            img.style.cssText = 'object-fit:cover; border-radius:4px;';
            img.addEventListener('error', () => { img.src = SIN_IMAGEN; }, { once: true });
            tdImg.appendChild(img);

            // Textos (textContent evita inyección de HTML)
            const tdNombre = document.createElement('td');
            tdNombre.textContent = p.nombre;

            const tdPrecio = document.createElement('td');
            tdPrecio.textContent = `$${parseFloat(p.precio).toFixed(2)}`;

            const tdCategoria = document.createElement('td');
            tdCategoria.textContent = categoria;

            // Acciones
            const tdAcciones = document.createElement('td');

            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn-edit';
            btnEditar.textContent = 'Editar';
            btnEditar.dataset.accion = 'editar';
            btnEditar.dataset.id = p.id;
            btnEditar.dataset.nombre = p.nombre;
            btnEditar.dataset.precio = p.precio;
            btnEditar.dataset.categoria = categoria;

            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'btn-delete';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.dataset.accion = 'eliminar';
            btnEliminar.dataset.id = p.id;

            tdAcciones.append(btnEditar, ' ', btnEliminar);
            tr.append(tdImg, tdNombre, tdPrecio, tdCategoria, tdAcciones);
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

    // Al crear, la imagen es obligatoria; al editar es opcional
    if (!id && !fileInput.files[0]) {
        alert('Seleccioná una imagen para el producto.');
        return;
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
        const res = await fetch(url, { method: metodo, body: formData });

        if (res.ok) {
            limpiarFormulario();
            await cargarCategoriasEnSelect();
            cargarProductosAdmin();
        } else {
            if (res.status === 401) {
                alert('Tu sesión expiró. Volvé a iniciar sesión.');
                window.location.href = '/login';
                return;
            }
            const data = await res.json().catch(() => ({}));
            alert(data.mensaje || 'Error al procesar la solicitud');
        }
    } catch (err) {
        console.error('Error al guardar:', err);
        alert('Error de conexión con el servidor.');
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
        nuevaCategoriaInput.setAttribute('required', 'true');
        nuevaCategoriaInput.value = categoria;
    }

    document.getElementById('form-titulo').textContent = 'Editar Producto';
    document.getElementById('btn-guardar').textContent = 'Actualizar Producto';
    document.getElementById('btn-cancelar').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    document.getElementById('form-titulo').textContent = 'Agregar Producto';
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
        } else if (res.status === 401) {
            window.location.href = '/login';
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
    window.location.href = '/login';
}
