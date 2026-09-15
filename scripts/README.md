# scripts

## `mockup-demo.html`

Fuente de las imágenes de `public/demo/`, que ilustran cómo aparece una tienda
dentro de un asistente.

La tienda (**Almacén Rivas**) y sus productos son **ficticios**, y el packaging
va dibujado en SVG en vez de fotografiado. Es deliberado: publicar una demo con
una tienda real dice públicamente que ese comercio está en el piloto, y eso no
se publica sin su autorización por escrito. Si más adelante un comercio autoriza
aparecer, se reemplazan estas imágenes y se deja constancia de la autorización.

Para regenerarlas, abre el archivo en un navegador a 1100×720 y captura cada
`.cuadro`, o con Playwright:

```js
const { chromium } = require("playwright");
const navegador = await chromium.launch();
const pagina = await (await navegador.newContext({
  viewport: { width: 1100, height: 720 }, deviceScaleFactor: 2,
})).newPage();
await pagina.goto("file:///ruta/a/scripts/mockup-demo.html");
for (const [id, nombre] of [
  ["cuadro-1", "demo-1-pregunta"],
  ["cuadro-2", "demo-2-respuesta"],
  ["cuadro-3", "demo-3-carrito"],
]) {
  await pagina.locator(`#${id}`).screenshot({ path: `${nombre}.png` });
}
```

Después conviértelas a WebP (calidad 84) y déjalas en `public/demo/`.
