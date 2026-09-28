<?php
    // Datos del juego: definición de tiles y pantallas
    require 'datos/tipos.php';
    require 'datos/pantallas.php';

    // Todo lo que necesita el motor JS (js/juego.js)
    $config = [
        'tam'          => 16,
        'transitables' => $transitables,
        'conFondo'     => $conFondo,
        'pantallas'    => $pantallas,
        'inicio'       => $inicio,
    ];

    include 'template/index.php';
?>
