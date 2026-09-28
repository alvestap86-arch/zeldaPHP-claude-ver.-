// TLOPHP - motor del juego
// Los datos (pantallas, tiles sólidos...) los genera PHP y llegan en window.JUEGO.
(() => {
    'use strict';

    const J = window.JUEGO;
    const T = J.tam;                    // tamaño de tile (16 px)
    const COLS = 16, FILAS = 16;
    const ANCHO = COLS * T, ALTO = FILAS * T;

    // Caja de colisión del jugador, relativa a su sprite de 16x16 (sólo los "pies")
    const HB = { x: 3, y: 8, w: 10, h: 8 };
    const VEL = 1.4;                    // píxeles por tick (60 ticks/s)
    const TICKS_SCROLL = 30;            // duración del cambio de pantalla
    const TICKS_FADE = 14;              // duración de cada mitad del fundido (puertas)

    const lienzo = document.getElementById('lienzo');
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const cuadroDialogo = document.getElementById('dialogo');
    const cuadroDebug = document.getElementById('depuracion');
    const contenedor = document.getElementById('juego');

    const transitables = new Set(J.transitables);
    const conFondo = new Set(J.conFondo);

    // ---------- Carga de imágenes ----------
    const cargar = src => new Promise((ok, fallo) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => fallo(new Error('No se pudo cargar ' + src));
        img.src = src;
    });

    let tileset, spJugador;
    const spNpc = {};
    const capas = {};                   // pantalla -> canvas con el fondo ya dibujado

    // "d1" -> posición dentro del tileset (columna = letra, fila = número)
    function origenTile(codigo) {
        const c = codigo.charCodeAt(0) - 97;
        const f = parseInt(codigo.slice(1), 10) - 1;
        return [44 + 17 * c, 1 + 17 * f];
    }

    function dibujarTile(g, codigo, col, fila) {
        const [sx, sy] = origenTile(codigo);
        g.drawImage(tileset, sx, sy, T, T, col * T, fila * T, T, T);
    }

    function prerenderizar(id) {
        const p = J.pantallas[id];
        const cv = document.createElement('canvas');
        cv.width = ANCHO; cv.height = ALTO;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        for (let f = 0; f < FILAS; f++) {
            for (let c = 0; c < COLS; c++) {
                const codigo = p.tablero[f][c];
                if (conFondo.has(codigo)) dibujarTile(g, p.fondo || 'd1', c, f);
                dibujarTile(g, codigo, c, f);
            }
        }
        capas[id] = cv;
    }

    // ---------- Estado ----------
    const est = {
        pantalla: J.inicio.pantalla,
        x: J.inicio.x * T,
        y: J.inicio.y * T,
        dir: 'abajo',
        anim: 0,
        modo: 'juego',                  // 'juego' | 'scroll' | 'fade'
        trans: null,
        depuracion: false,
    };
    const dialogo = { texto: '', letras: 0 };

    const pantallaActual = () => J.pantallas[est.pantalla];
    const npcsDe = id => J.pantallas[id].npcs || [];

    // ---------- Entrada ----------
    const orden = [];                   // direcciones pulsadas, la última manda
    const TECLAS = {
        arrowup: 'arriba', w: 'arriba',
        arrowdown: 'abajo', s: 'abajo',
        arrowleft: 'izquierda', a: 'izquierda',
        arrowright: 'derecha', d: 'derecha',
    };
    const pulsar = d => { if (!orden.includes(d)) orden.push(d); };
    const soltar = d => { const i = orden.indexOf(d); if (i >= 0) orden.splice(i, 1); };

    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if (TECLAS[k]) { pulsar(TECLAS[k]); e.preventDefault(); }
        else if (k === 'h' && !e.repeat) est.depuracion = !est.depuracion;
        else if (k === ' ' || k === 'enter') dialogo.letras = dialogo.texto.length;
    });
    window.addEventListener('keyup', e => {
        const k = e.key.toLowerCase();
        if (TECLAS[k]) soltar(TECLAS[k]);
    });
    window.addEventListener('blur', () => { orden.length = 0; });

    document.querySelectorAll('#mando button').forEach(b => {
        const d = b.dataset.dir;
        b.addEventListener('pointerdown', e => { pulsar(d); e.preventDefault(); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
            b.addEventListener(ev, () => soltar(d)));
    });

    // ---------- Colisiones ----------
    function rectsSeSolapan(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    // ¿Chocaría el jugador si su sprite estuviese en (x, y)?
    function choca(x, y, id = est.pantalla) {
        const hx = x + HB.x, hy = y + HB.y;
        const p = J.pantallas[id];
        const c0 = Math.floor(hx / T), c1 = Math.floor((hx + HB.w - 0.01) / T);
        const r0 = Math.floor(hy / T), r1 = Math.floor((hy + HB.h - 0.01) / T);
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                if (r < 0 || r >= FILAS || c < 0 || c >= COLS) continue;
                if (!transitables.has(p.tablero[r][c])) return true;
            }
        }
        for (const n of npcsDe(id)) {
            if (rectsSeSolapan(hx, hy, HB.w, HB.h, n.col * T + 1, n.fila * T + 8, 14, 8)) return true;
        }
        return false;
    }

    // ¿Se saldría de la pantalla? Devuelve 'norte' | 'sur' | 'este' | 'oeste' | null
    function cruzaBorde(x, y) {
        const hx = x + HB.x, hy = y + HB.y;
        if (hx < 0) return 'oeste';
        if (hx + HB.w > ANCHO) return 'este';
        if (hy < 0) return 'norte';
        if (hy + HB.h > ALTO) return 'sur';
        return null;
    }

    const VECTOR = { arriba: [0, -1], abajo: [0, 1], izquierda: [-1, 0], derecha: [1, 0] };

    // Devuelve true si el jugador se ha movido
    function mover(d) {
        const [dx, dy] = VECTOR[d];
        const nx = est.x + dx * VEL, ny = est.y + dy * VEL;

        const borde = cruzaBorde(nx, ny);
        if (borde) {
            const destino = pantallaActual().salidas[borde];
            if (!destino) return false;         // borde sin salida: pared invisible
            const [fx, fy] = posicionAlEntrar(borde);
            if (choca(fx, fy, destino)) return false;   // el otro lado está bloqueado
            iniciarScroll(borde, destino);
            return true;
        }
        if (!choca(nx, ny)) { est.x = nx; est.y = ny; return true; }

        // Ayuda en esquinas: si sólo roza, se desliza 1 px hacia el hueco (hasta 6 px)
        for (let n = 1; n <= 6; n++) {
            for (const s of [-1, 1]) {
                if (!choca(nx + (dy ? s * n : 0), ny + (dx ? s * n : 0))) {
                    const ax = est.x + (dy ? s : 0), ay = est.y + (dx ? s : 0);
                    if (!choca(ax, ay)) { est.x = ax; est.y = ay; return true; }
                }
            }
        }
        return false;
    }

    // ---------- Cambio de pantalla (scroll) ----------
    // Dónde aparece el jugador en la pantalla vecina al salir por 'borde'
    function posicionAlEntrar(borde) {
        let fx = est.x, fy = est.y;
        if (borde === 'este')  fx = 2 - HB.x;
        if (borde === 'oeste') fx = ANCHO - 2 - HB.w - HB.x;
        if (borde === 'sur')   fy = 2 - HB.y;
        if (borde === 'norte') fy = ALTO - 2 - HB.h - HB.y;
        return [fx, fy];
    }

    function iniciarScroll(borde, destino) {
        const [fx, fy] = posicionAlEntrar(borde);
        est.trans = {
            borde, destino, origen: est.pantalla, t: 0,
            dx: { este: 1, oeste: -1 }[borde] || 0,
            dy: { sur: 1, norte: -1 }[borde] || 0,
            x0: est.x, y0: est.y, x1: fx, y1: fy,
        };
        est.modo = 'scroll';
        ocultarDialogo();
    }

    function actualizarScroll() {
        const tr = est.trans;
        tr.t += 1 / TICKS_SCROLL;
        if (tr.t >= 1) {
            est.pantalla = tr.destino;
            est.x = tr.x1; est.y = tr.y1;
            est.trans = null;
            est.modo = 'juego';
        }
    }

    // ---------- Puertas / escaleras (fundido a negro) ----------
    function comprobarPuertas() {
        const cx = est.x + HB.x + HB.w / 2, cy = est.y + HB.y + HB.h / 2;
        const c = Math.floor(cx / T), f = Math.floor(cy / T);
        for (const [pf, pc, destino, df, dc] of pantallaActual().puertas) {
            if (pf === f && pc === c) {
                est.trans = { destino, x: dc * T, y: df * T, t: 0, fase: 'salida' };
                est.modo = 'fade';
                ocultarDialogo();
                return;
            }
        }
    }

    function actualizarFade() {
        const tr = est.trans;
        tr.t += 1 / TICKS_FADE;
        if (tr.t >= 1) {
            if (tr.fase === 'salida') {
                est.pantalla = tr.destino;
                est.x = tr.x; est.y = tr.y;
                tr.fase = 'entrada'; tr.t = 0;
            } else {
                est.trans = null;
                est.modo = 'juego';
            }
        }
    }

    // ---------- Diálogos ----------
    function ocultarDialogo() {
        dialogo.texto = ''; dialogo.letras = 0;
        cuadroDialogo.hidden = true;
    }

    function actualizarDialogo() {
        const cx = est.x + 8, cy = est.y + 12;
        let cercano = null;
        for (const n of npcsDe(est.pantalla)) {
            if (Math.hypot(cx - (n.col * T + 8), cy - (n.fila * T + 12)) < 44) cercano = n;
        }
        if (!cercano) { if (dialogo.texto) ocultarDialogo(); return; }
        if (dialogo.texto !== cercano.texto) { dialogo.texto = cercano.texto; dialogo.letras = 0; }
        if (dialogo.letras < dialogo.texto.length) dialogo.letras += 0.5;
        cuadroDialogo.hidden = false;
        cuadroDialogo.textContent = dialogo.texto.slice(0, Math.floor(dialogo.letras));
    }

    // ---------- Bucle de actualización ----------
    function actualizar() {
        if (est.modo === 'scroll') return actualizarScroll();
        if (est.modo === 'fade') return actualizarFade();

        const d = orden[orden.length - 1];
        let movido = false;
        if (d) { est.dir = d; movido = mover(d); }
        est.anim = movido ? est.anim + 1 : 0;

        if (est.modo === 'juego') { comprobarPuertas(); actualizarDialogo(); }
    }

    // ---------- Dibujo ----------
    const FRAME = { abajo: 0, arriba: 2, izquierda: 4, derecha: 6 };

    function dibujarPantalla(id, ox, oy) {
        ctx.drawImage(capas[id], Math.round(ox), Math.round(oy));
        for (const n of npcsDe(id)) {
            ctx.drawImage(spNpc[n.sprite], Math.round(ox + n.col * T), Math.round(oy + n.fila * T));
        }
    }

    function dibujarJugador(x, y) {
        const paso = Math.floor(est.anim / 8) % 2;
        ctx.drawImage(spJugador, (FRAME[est.dir] + paso) * T, 0, T, T, Math.round(x), Math.round(y), T, T);
    }

    function dibujarDepuracion() {
        const p = pantallaActual();
        ctx.fillStyle = 'rgba(255,0,0,0.35)';
        for (let f = 0; f < FILAS; f++)
            for (let c = 0; c < COLS; c++)
                if (!transitables.has(p.tablero[f][c])) ctx.fillRect(c * T, f * T, T, T);
        ctx.strokeStyle = '#0f0';
        ctx.strokeRect(est.x + HB.x + 0.5, est.y + HB.y + 0.5, HB.w - 1, HB.h - 1);
        cuadroDebug.hidden = false;
        cuadroDebug.textContent = `${est.pantalla}  x:${est.x.toFixed(1)} y:${est.y.toFixed(1)}`;
    }

    function dibujar() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, ANCHO, ALTO);

        if (est.modo === 'scroll') {
            const tr = est.trans;
            const sx = tr.dx * ANCHO * tr.t, sy = tr.dy * ALTO * tr.t;
            dibujarPantalla(tr.origen, -sx, -sy);
            dibujarPantalla(tr.destino, tr.dx * ANCHO - sx, tr.dy * ALTO - sy);
            dibujarJugador(tr.x0 + (tr.x1 - tr.x0) * tr.t, tr.y0 + (tr.y1 - tr.y0) * tr.t);
        } else {
            dibujarPantalla(est.pantalla, 0, 0);
            dibujarJugador(est.x, est.y);
            if (est.depuracion) dibujarDepuracion();
            else cuadroDebug.hidden = true;

            if (est.modo === 'fade') {
                const a = est.trans.fase === 'salida' ? est.trans.t : 1 - est.trans.t;
                ctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, a))})`;
                ctx.fillRect(0, 0, ANCHO, ALTO);
            }
        }
    }

    // ---------- Escala de la ventana ----------
    function ajustarEscala() {
        const e = Math.max(1, Math.floor(Math.min(window.innerWidth / ANCHO, (window.innerHeight - 90) / ALTO)));
        contenedor.style.setProperty('--escala', e);
    }
    window.addEventListener('resize', ajustarEscala);

    // ---------- Arranque ----------
    let ultimo = 0, acumulado = 0;
    const PASO = 1000 / 60;
    function bucle(ahora) {
        acumulado += Math.min(ahora - ultimo, 100);
        ultimo = ahora;
        while (acumulado >= PASO) { actualizar(); acumulado -= PASO; }
        dibujar();
        requestAnimationFrame(bucle);
    }

    // Se expone para poder probar/depurar desde la consola del navegador
    window.__juego = { est, actualizar, pulsar, soltar, choca, posicionAlEntrar };

    const nombresNpc = new Set();
    Object.keys(J.pantallas).forEach(id => npcsDe(id).forEach(n => nombresNpc.add(n.sprite)));

    Promise.all([
        cargar('sprites/tileset.png'),
        cargar('sprites/jugador.png'),
        ...[...nombresNpc].map(n => cargar('sprites/' + n + '.png').then(img => { spNpc[n] = img; })),
    ]).then(([ts, jug]) => {
        tileset = ts; spJugador = jug;
        Object.keys(J.pantallas).forEach(prerenderizar);
        ajustarEscala();
        requestAnimationFrame(bucle);
        window.__juego.listo = true;
    }).catch(err => {
        console.error(err);
        document.body.insertAdjacentHTML('afterbegin', '<p style="color:#f66">' + err.message + '</p>');
    });
})();
