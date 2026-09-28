# TLOPHP

Juego tipo Zelda con PHP (datos) + JavaScript (motor). Arranque: `php -S localhost:8000` y abre http://localhost:8000

Controles: flechas o WASD. `H` muestra las colisiones (rojo) y la caja del jugador (verde).

## Estructura
- `index.php` – carga los datos y los pasa al motor como JSON
- `datos/tipos.php` – nombres de tiles, cuáles son transitables y cuáles se dibujan sobre suelo
- `datos/pantallas.php` – cada pantalla: `tablero`, `salidas`, `puertas`, `fondo`, `npcs`
- `js/juego.js` – movimiento, colisiones, cambio de pantalla, puertas, diálogos
- `sprites/jugador.png`, `sprites/viejo.png` – sprites propios (16x16); cámbialos por los tuyos
- `template/tiles-antiguo.css` – el CSS de tiles original (ya no se usa)

## Añadir una pantalla
1. Copia una entrada de `$pantallas` con un tablero de 16x16 códigos.
2. En la pantalla vecina, añade en `salidas` (`norte`,`sur`,`este`,`oeste`) el id de la nueva y viceversa.
3. Deja el hueco de la salida en las mismas filas/columnas en las dos pantallas.
Puertas: `[fila, col, destino, filaDestino, colDestino]` (en tiles).
