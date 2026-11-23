# Supercar GP 3D

Juego de carreras de superdeportivos en 3D para Android (motor three.js r187, licencia MIT).

- 6 circuitos inspirados en Monza, Montecarlo, Suzuka, Spa (lluvia), Las Vegas (noche) y Jarama.
- 6 coches 3D con pintura reflectante, 10 colores y mejoras de motor, neumáticos y nitro.
- Modos: Campeonato (6 carreras con puntos), Carrera rápida y Contrarreloj con fantasma.
- Derrapes y rebufo recargan el nitro; 3 cámaras; controles táctiles, inclinación o mando.

## Código
El juego está en `src3d/` (un archivo por parte). `python3 build.py` dentro de `src3d`
genera `app/src/main/assets/game.js` (three.js + juego en un solo archivo).

## Actualización automática
La app descarga sola `index.html` y `game.js` de este repositorio cuando sube `version.txt`,
así que los cambios llegan sin instalar otra APK. Cada cambio en `main` también compila la APK
firmada en **Releases → "Supercar GP (última versión)"**.
