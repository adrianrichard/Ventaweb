document.addEventListener('DOMContentLoaded', iniciarCarrusel);

async function iniciarCarrusel() {
    const contenedor = document.getElementById('carrusel');
    if (!contenedor) return;

    try {
        const res = await fetch('/api/carrusel');
        if (!res.ok) return;

        const imagenes = await res.json();
        if (!Array.isArray(imagenes) || imagenes.length === 0) return; // sin imágenes, el carrusel no se muestra

        construirCarrusel(contenedor, imagenes);
    } catch (err) {
        console.error('Error al cargar el carrusel:', err);
    }
}

function construirCarrusel(contenedor, imagenes) {
    const total = imagenes.length;
    let indice = 0;
    let temporizador = null;

    contenedor.innerHTML = `
        <div class="carrusel-pista"></div>
        <button type="button" class="carrusel-btn carrusel-prev" aria-label="Imagen anterior">&#10094;</button>
        <button type="button" class="carrusel-btn carrusel-next" aria-label="Imagen siguiente">&#10095;</button>
        <div class="carrusel-puntos"></div>
    `;

    const pista = contenedor.querySelector('.carrusel-pista');
    const puntos = contenedor.querySelector('.carrusel-puntos');
    const btnPrev = contenedor.querySelector('.carrusel-prev');
    const btnNext = contenedor.querySelector('.carrusel-next');

    imagenes.forEach((imagen, i) => {
        const slide = document.createElement('div');
        slide.className = 'carrusel-slide';

        const img = document.createElement('img');
        img.src = `/api/carrusel/${imagen.id}/imagen`;
        img.alt = `Imagen ${i + 1} de ${total}`;
        slide.appendChild(img);
        pista.appendChild(slide);

        const punto = document.createElement('button');
        punto.type = 'button';
        punto.className = 'carrusel-punto';
        punto.setAttribute('aria-label', `Ir a la imagen ${i + 1}`);
        punto.addEventListener('click', () => { ir(i); reiniciarAutoplay(); });
        puntos.appendChild(punto);
    });

    function ir(nuevoIndice) {
        indice = (nuevoIndice + total) % total;
        pista.style.transform = `translateX(-${indice * 100}%)`;
        puntos.querySelectorAll('.carrusel-punto').forEach((p, i) => {
            p.classList.toggle('activo', i === indice);
        });
    }

    function iniciarAutoplay() {
        const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (total < 2 || sinMovimiento) return;
        detenerAutoplay();
        temporizador = setInterval(() => ir(indice + 1), 5000);
    }

    function detenerAutoplay() {
        if (temporizador) clearInterval(temporizador);
        temporizador = null;
    }

    function reiniciarAutoplay() {
        detenerAutoplay();
        iniciarAutoplay();
    }

    btnPrev.addEventListener('click', () => { ir(indice - 1); reiniciarAutoplay(); });
    btnNext.addEventListener('click', () => { ir(indice + 1); reiniciarAutoplay(); });

    // Se pausa mientras el mouse está encima o hay foco dentro del carrusel
    contenedor.addEventListener('mouseenter', detenerAutoplay);
    contenedor.addEventListener('mouseleave', iniciarAutoplay);
    contenedor.addEventListener('focusin', detenerAutoplay);
    contenedor.addEventListener('focusout', iniciarAutoplay);

    // Deslizar con el dedo en el celular
    let inicioX = null;
    contenedor.addEventListener('touchstart', (e) => { inicioX = e.touches[0].clientX; }, { passive: true });
    contenedor.addEventListener('touchend', (e) => {
        if (inicioX === null) return;
        const diferencia = e.changedTouches[0].clientX - inicioX;
        inicioX = null;
        if (Math.abs(diferencia) > 50) {
            ir(diferencia < 0 ? indice + 1 : indice - 1);
            reiniciarAutoplay();
        }
    }, { passive: true });

    // Con una sola imagen no hacen falta flechas ni puntos
    if (total < 2) {
        btnPrev.hidden = true;
        btnNext.hidden = true;
        puntos.hidden = true;
    }

    ir(0);
    iniciarAutoplay();
    contenedor.hidden = false;
}
