<!DOCTYPE html>
<html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>TLOPHP</title>
        <link rel="stylesheet" href="template/styles.css">
    </head>
    <body>
        <div id="juego">
            <canvas id="lienzo" width="256" height="256"></canvas>
            <div id="dialogo" hidden></div>
            <div id="depuracion" hidden></div>
        </div>

        <p id="ayuda">Mover: flechas o WASD &middot; H: ver colisiones</p>

        <div id="mando">
            <button data-dir="arriba">&#9650;</button>
            <button data-dir="izquierda">&#9664;</button>
            <button data-dir="abajo">&#9660;</button>
            <button data-dir="derecha">&#9654;</button>
        </div>

        <script>
            window.JUEGO = <?= json_encode($config, JSON_UNESCAPED_UNICODE) ?>;
        </script>
        <script src="js/juego.js"></script>
    </body>
</html>
