'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const publicRoot = path.resolve(__dirname, '../public');
const html2pdfBundle = require.resolve('html2pdf.js/dist/html2pdf.bundle.min.js');
const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
const pdfjsWorkerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
let server, baseUrl;
let html2pdfBytes;
const peticiones = [];
const atletas = Array.from({ length: 28 }, (_, indice) => ({
    nombres: indice === 0 ? 'Niña <Prueba>' : 'Atleta',
    apellidos: indice === 0 ? 'Álvarez & Sintética' : `Sintético ${String(indice).padStart(2, '0')}`,
    cedula: `V-${90000000 + indice}`, fecha_nacimiento: '2018-05-10'
}));

test.before(async () => {
    html2pdfBytes = await fs.readFile(html2pdfBundle);
    server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;
        if (pathname === '/__test__/pdf.mjs' || pathname === '/__test__/pdf.worker.mjs') {
            const data = await fs.readFile(pathname.endsWith('worker.mjs') ? pdfjsWorkerPath : pdfjsPath);
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            return res.end(data);
        }
        if (pathname === '/api/auth/me') return json(res, {
            success: true,
            sesion: { id: 'sesion-sintetica-general', servidor: Date.now(),
                vence: Date.now() + 900000, limite: Date.now() + 43200000 },
            usuario: { id_usuario: 1, rol: 'directiva', nombres: 'Directiva', apellidos: 'Sintética' }
        });
        if (pathname === '/api/directiva/auditoria') return json(res, {
            metricas: { activos: 0, espera: 0, pagos_pendientes: 0 },
            tasa_bcv: 36.5, tasa_fecha: null, atletas: [], pagos: []
        });
        if (pathname === '/api/directiva/atletas/planilla-general') {
            peticiones.push(url.search);
            const codigo = url.searchParams.get('categoria');
            const lista = codigo === 'u9' ? atletas : [];
            return json(res, { success: true,
                categoria: { codigo, nombre: codigo === 'u9' ? 'U-9 Iniciación' : 'U-15 Infantil (M)' },
                fecha: '2026-11-11', total: lista.length, atletas: lista });
        }
        if (pathname.startsWith('/api/')) return json(res, { success: true, datos: [] });
        const filePath = path.resolve(publicRoot, '.' + decodeURI(pathname === '/' ? '/index.html' : pathname));
        if (!filePath.startsWith(publicRoot + path.sep)) {
            res.writeHead(403); return res.end();
        }
        try {
            const body = await fs.readFile(filePath);
            const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(filePath)] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': type }); return res.end(body);
        } catch { res.writeHead(404); return res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});

function json(res, body) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function abrir(viewport) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await context.newPage();
    const errores = [];
    page.on('pageerror', error => errores.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.route('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
        route => route.fulfill({ status: 200, contentType: 'application/javascript',
            body: html2pdfBytes }));
    await page.goto(baseUrl + '/admin/panel-directiva.html');
    await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
    const toggleMovil = page.locator('#mobile-menu-btn');
    if (await toggleMovil.isVisible()) await toggleMovil.click();
    const item = page.locator('[data-target="sec-atletas"]');
    const grupo = item.locator('xpath=ancestor::li[contains(concat(" ", normalize-space(@class), " "), " sidebar-group ")]');
    if (await grupo.count()) {
        const botonGrupo = grupo.locator('.sidebar-group__toggle');
        if (await botonGrupo.getAttribute('aria-expanded') !== 'true') await botonGrupo.click();
    }
    await item.click();
    return { browser, context, page, errores };
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`categoría elegida genera PDF paginado en ${viewport.width}px`, async () => {
        const { browser, context, page, errores } = await abrir(viewport);
        try {
            const categoria = page.locator('#filter-categoria-atletas');
            const boton = page.locator('#generar-planilla-general');
            assert.equal(await boton.evaluate(elemento => elemento.hidden), true);
            await categoria.selectOption('u9');
            assert.equal(await boton.evaluate(elemento => elemento.hidden), false);
            await page.locator('#search-atletas').fill('texto que no coincide');
            await page.locator('#filter-estado-atletas').selectOption('espera');
            await page.evaluate(() => {
                window.__planillaGeneralVista = null;
                const observador = new MutationObserver(() => {
                    const nodo = document.querySelector('.planilla-general-export');
                    if (nodo) {
                        window.__planillaGeneralVista = {
                            texto: nodo.textContent,
                            paginas: nodo.querySelectorAll('.planilla-general-pagina').length,
                            logo: nodo.querySelector('.planilla-general-logo')?.getAttribute('src')
                        };
                        observador.disconnect();
                    }
                });
                observador.observe(document.body, { childList: true });
            });
            const descarga = page.waitForEvent('download');
            await page.evaluate(() => document.getElementById('generar-planilla-general').click());
            const download = await descarga;
            assert.equal(download.suggestedFilename(), 'Planilla_General_Jaguares_U9.pdf');
            assert.deepEqual(peticiones.slice(-1), ['?categoria=u9']);
            const bytes = await fs.readFile(await download.path());
            assert.ok(bytes.byteLength > 10000, `PDF demasiado pequeño: ${bytes.byteLength} bytes`);
            const vista = await page.evaluate(() => window.__planillaGeneralVista);
            assert.equal(vista.paginas, 2);
            assert.equal(vista.logo, '../img/logo-sinfondo.png');
            assert.match(vista.texto, /Club Jaguares/);
            assert.match(vista.texto, /U-9 Iniciación/);
            assert.match(vista.texto, /Niña <Prueba>/);
            assert.match(vista.texto, /Sintético 27/);
            assert.doesNotMatch(vista.texto, /alergias|teléfono|dirección|pago/i);
            const contenido = await page.evaluate(async ({ baseUrl, bytes }) => {
                const pdfjs = await import(baseUrl + '/__test__/pdf.mjs');
                pdfjs.GlobalWorkerOptions.workerSrc = baseUrl + '/__test__/pdf.worker.mjs';
                const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
                const paginas = [];
                for (let indice = 1; indice <= pdf.numPages; indice++) {
                    const pagina = await pdf.getPage(indice);
                    const viewport = pagina.getViewport({ scale: 0.5 });
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.ceil(viewport.width);
                    canvas.height = Math.ceil(viewport.height);
                    const contexto = canvas.getContext('2d', { willReadFrequently: true });
                    await pagina.render({ canvasContext: contexto, viewport }).promise;
                    const pixels = contexto.getImageData(0, 0, canvas.width, canvas.height).data;
                    let contenido = 0;
                    for (let pixel = 0; pixel < pixels.length; pixel += 16) {
                        if (pixels[pixel] < 230 || pixels[pixel + 1] < 230 || pixels[pixel + 2] < 230) contenido++;
                    }
                    paginas.push(contenido);
                }
                await pdf.destroy();
                return paginas;
            }, { baseUrl, bytes: Array.from(bytes) });
            assert.equal(contenido.length, 2, 'debe paginar más de 25 filas sin páginas vacías');
            assert.ok(contenido.every(pixels => pixels > 1000),
                'cada página debe contener filas visibles: ' + JSON.stringify(contenido));
            assert.deepEqual(errores, []);
            assert.equal(await boton.isDisabled(), false);
        } finally { await context.close(); await browser.close(); }
    });
}

test('una categoría sin activos muestra aviso y no descarga archivo', async () => {
    const { browser, context, page } = await abrir({ width: 1280, height: 800 });
    try {
        await page.locator('#filter-categoria-atletas').selectOption('u15');
        await page.locator('#generar-planilla-general').click();
        await page.getByText('No hay atletas activos en esta categoría.').waitFor();
        assert.equal(await page.locator('.planilla-general-export').count(), 0);
        assert.equal(await page.locator('#generar-planilla-general').isDisabled(), false);
    } finally { await context.close(); await browser.close(); }
});
