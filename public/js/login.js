document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    errorMsg.textContent = '';

    try {
        // Ruta relativa: usa el mismo dominio desde el que se sirve la página
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username, password })
        });

        // Si el servidor devuelve algo que no es JSON (ej. página de error HTML), no rompe
        const resultado = await respuesta.json().catch(() => ({}));

        if (respuesta.ok) {
            window.location.href = '/admin';
        } else {
            errorMsg.textContent = resultado.mensaje || `Error del servidor (${respuesta.status})`;
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        errorMsg.textContent = 'Error de conexión con el servidor.';
    }
});
