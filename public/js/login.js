document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');

    try {
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // Redirigir directamente a la ruta /admin configurada en Express
            window.location.href = '/admin';
        } else {
            errorMsg.textContent = resultado.mensaje || 'Credenciales incorrectas';
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        errorMsg.textContent = 'Error de conexión con el servidor.';
    }
});