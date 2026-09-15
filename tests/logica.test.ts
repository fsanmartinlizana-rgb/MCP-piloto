import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarUrlTienda } from "@/lib/validacion/inscripcion";
import { aNumero, limpiarHtml, hashProducto, type ProductoNormalizado } from "@/lib/ingesta/normalizar";
import { parsearRobots, puedeAcceder, crawlDelay } from "@/lib/ingesta/robots";
import { leerJsonLd } from "@/lib/ingesta/conectores/jsonld";
import { anonimizarConsulta } from "@/lib/anonimizar";
import { agregarUtms } from "@/lib/handoffs/utm";

const BOT = "DolfsBot/0.1 (+https://dolfs.cl/bot)";

// --- normalizacion de URL de tienda -----------------------------------------

test("normalizarUrlTienda acepta dominios sin esquema y quita www", () => {
  assert.equal(normalizarUrlTienda("mitienda.cl")?.url, "https://mitienda.cl");
  assert.equal(normalizarUrlTienda("www.mitienda.cl")?.clave, "mitienda.cl");
  assert.equal(normalizarUrlTienda("HTTP://WWW.MiTienda.CL/")?.clave, "mitienda.cl");
});

test("normalizarUrlTienda conserva la ruta cuando la tienda vive en un subdirectorio", () => {
  assert.equal(normalizarUrlTienda("mitienda.cl/tienda/")?.clave, "mitienda.cl/tienda");
});

test("normalizarUrlTienda rechaza lo que no es un dominio publico", () => {
  for (const entrada of ["localhost", "foo", "", "javascript:alert(1)", "ftp://x.cl"]) {
    assert.equal(normalizarUrlTienda(entrada), null, `deberia rechazar: ${entrada}`);
  }
});

test("dos formas de escribir la misma tienda dan la misma clave", () => {
  const a = normalizarUrlTienda("https://www.mitienda.cl/");
  const b = normalizarUrlTienda("mitienda.cl");
  assert.equal(a?.clave, b?.clave);
});

// --- precios ------------------------------------------------------------------

test("aNumero entiende los formatos de precio que llegan de las tiendas", () => {
  assert.equal(aNumero("19990"), 19990);
  assert.equal(aNumero("$19.990"), 19990);       // miles con punto, CLP
  assert.equal(aNumero("1.234,56"), 1234.56);    // formato europeo
  assert.equal(aNumero("1,234.56"), 1234.56);    // formato ingles
  assert.equal(aNumero("19,990"), 19990);        // coma como separador de miles
  assert.equal(aNumero("19.99"), 19.99);         // punto decimal de verdad
  assert.equal(aNumero("1.234.567"), 1234567);   // miles repetidos
  assert.equal(aNumero("19990.00"), 19990);      // lo que entrega Shopify
  assert.equal(aNumero(19990), 19990);
  assert.equal(aNumero("19.990 CLP"), 19990);
  assert.equal(aNumero(""), null);
  assert.equal(aNumero(null), null);
});

test("limpiarHtml deja texto legible y bota scripts", () => {
  const salida = limpiarHtml("<p>Polera <b>azul</b></p><script>alert(1)</script>&amp; algodon");
  assert.ok(salida?.includes("Polera azul"));
  assert.ok(!salida?.includes("alert"));
  assert.ok(salida?.includes("& algodon"));
});

test("hashProducto cambia con el precio y no con el orden de lectura", () => {
  const base: ProductoNormalizado = {
    sku: "A1", nombre: "Polera", descripcion: null, precio: 19990, moneda: "CLP",
    stock_disponible: true, url_producto: "https://t.cl/p/1", imagen_url: null, categoria: null,
  };
  assert.equal(hashProducto(base), hashProducto({ ...base }));
  assert.notEqual(hashProducto(base), hashProducto({ ...base, precio: 17990 }));
});

// --- robots.txt ---------------------------------------------------------------

test("puedeAcceder respeta un Disallow que apunta al catalogo", () => {
  const robots = parsearRobots("User-agent: *\nDisallow: /products.json\n");
  assert.equal(puedeAcceder(robots, "https://t.cl/products.json", BOT), false);
  assert.equal(puedeAcceder(robots, "https://t.cl/", BOT), true);
});

test("un grupo especifico para nuestro bot gana sobre el comodin", () => {
  const robots = parsearRobots(
    "User-agent: *\nDisallow: /\n\nUser-agent: DolfsBot\nDisallow:\n",
  );
  assert.equal(puedeAcceder(robots, "https://t.cl/products.json", BOT), true);
});

test("Disallow vacio significa permitir todo, no bloquear todo", () => {
  const robots = parsearRobots("User-agent: *\nDisallow:\n");
  assert.equal(puedeAcceder(robots, "https://t.cl/cualquier/cosa", BOT), true);
});

test("gana el patron mas largo y en empate gana Allow", () => {
  const robots = parsearRobots("User-agent: *\nDisallow: /p\nAllow: /products.json\n");
  assert.equal(puedeAcceder(robots, "https://t.cl/products.json", BOT), true);
  assert.equal(puedeAcceder(robots, "https://t.cl/privado", BOT), false);
});

test("se leen comodines, anclas, sitemaps y crawl-delay", () => {
  const robots = parsearRobots(
    "Sitemap: https://t.cl/sitemap.xml\nUser-agent: *\nCrawl-delay: 2\nDisallow: /*.pdf$\n",
  );
  assert.deepEqual(robots.sitemaps, ["https://t.cl/sitemap.xml"]);
  assert.equal(crawlDelay(robots, BOT), 2);
  assert.equal(puedeAcceder(robots, "https://t.cl/manual.pdf", BOT), false);
  assert.equal(puedeAcceder(robots, "https://t.cl/manual.pdf.html", BOT), true);
});

test("varios User-agent seguidos comparten el mismo bloque de reglas", () => {
  const robots = parsearRobots("User-agent: GPTBot\nUser-agent: DolfsBot\nDisallow: /secreto\n");
  assert.equal(puedeAcceder(robots, "https://t.cl/secreto", BOT), false);
});

// --- JSON-LD -------------------------------------------------------------------

test("leerJsonLd saca un Product suelto", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Zapatilla runner",
    sku: "ZR-42",
    image: ["/img/zr.jpg"],
    offers: { "@type": "Offer", price: "49990", priceCurrency: "CLP", availability: "https://schema.org/InStock" },
  })}</script>`;

  const [producto] = leerJsonLd(html, "https://t.cl/producto/zr");
  assert.equal(producto.nombre, "Zapatilla runner");
  assert.equal(producto.sku, "ZR-42");
  assert.equal(producto.precio, 49990);
  assert.equal(producto.moneda, "CLP");
  assert.equal(producto.stock_disponible, true);
  assert.equal(producto.imagen_url, "https://t.cl/img/zr.jpg");
});

test("leerJsonLd baja hasta un Product dentro de @graph", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "WebSite", name: "Tienda" },
      { "@type": "Product", name: "Mochila", offers: { price: 29990, priceCurrency: "CLP" } },
    ],
  })}</script>`;

  const productos = leerJsonLd(html, "https://t.cl/producto/m");
  assert.equal(productos.length, 1);
  assert.equal(productos[0].nombre, "Mochila");
  assert.equal(productos[0].precio, 29990);
});

test("leerJsonLd toma la primera oferta cuando vienen varias", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "Polera",
    offers: [{ price: "9990", priceCurrency: "CLP" }, { price: "12990", priceCurrency: "CLP" }],
  })}</script>`;
  assert.equal(leerJsonLd(html, "https://t.cl/p")[0].precio, 9990);
});

test("leerJsonLd no revienta con JSON malformado ni inventa productos", () => {
  assert.deepEqual(leerJsonLd('<script type="application/ld+json">{roto</script>', "https://t.cl/p"), []);
  assert.deepEqual(leerJsonLd("<p>sin datos estructurados</p>", "https://t.cl/p"), []);
});

test("leerJsonLd descarta un Product sin nombre", () => {
  const html = `<script type="application/ld+json">{"@type":"Product","sku":"X"}</script>`;
  assert.deepEqual(leerJsonLd(html, "https://t.cl/p"), []);
});

// --- anonimizacion --------------------------------------------------------------

test("anonimizarConsulta borra email, RUT, telefono y URLs", () => {
  const salida = anonimizarConsulta(
    "busco zapatillas, soy juan@correo.cl rut 12.345.678-9 fono +56 9 8765 4321 ver https://x.cl?token=abc",
  );
  assert.ok(salida?.includes("busco zapatillas"));
  for (const filtrado of ["juan@correo.cl", "12.345.678-9", "8765 4321", "token=abc"]) {
    assert.ok(!salida?.includes(filtrado), `no deberia quedar: ${filtrado}`);
  }
});

test("anonimizarConsulta devuelve null cuando no queda nada util", () => {
  assert.equal(anonimizarConsulta(""), null);
  assert.equal(anonimizarConsulta(null), null);
  assert.equal(anonimizarConsulta("   "), null);
});

// --- UTMs --------------------------------------------------------------------------

test("agregarUtms marca el enlace sin romper los parametros de la tienda", () => {
  const url = new URL(agregarUtms("https://t.cl/products/polera?variant=42", "c-1"));
  assert.equal(url.searchParams.get("variant"), "42");
  assert.equal(url.searchParams.get("utm_source"), "dolfs");
  assert.equal(url.searchParams.get("utm_medium"), "mcp");
  assert.equal(url.searchParams.get("utm_campaign"), "piloto");
  assert.equal(url.searchParams.get("utm_content"), "c-1");
});

test("agregarUtms devuelve la entrada tal cual si no es una URL valida", () => {
  assert.equal(agregarUtms("no-es-url", "c-1"), "no-es-url");
});
