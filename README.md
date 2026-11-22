# Supercar GP

Juego de carreras arcade para Android: superdeportivos en 6 circuitos
(Monza, Montecarlo, Suzuka, Spa con lluvia, Las Vegas de noche y Jarama).

- Gráficos vectoriales dibujados a la resolución nativa de la pantalla.
- Garaje con 6 coches y 10 pinturas, créditos por carrera y circuitos que se desbloquean.
- Controles táctiles, inclinación del móvil, mando Bluetooth o teclado.

## Cómo se genera la APK
Cada cambio subido a `main` compila la APK firmada con GitHub Actions y la publica en
**Releases → "Supercar GP (última versión)"**. La firma es siempre la misma
(`supercargp.jks` + secreto `KEYSTORE_PASS`).

## Actualización automática
La app descarga sola `index.html` y `game.js` de este repositorio cuando sube `version.txt`,
así que los cambios del juego llegan sin instalar otra APK.
