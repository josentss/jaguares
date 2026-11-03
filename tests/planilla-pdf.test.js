const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const publicRoot = path.resolve(__dirname, '../public');
const html2pdfBundlePath = require.resolve('html2pdf.js/dist/html2pdf.bundle.min.js');
const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
const pdfjsWorkerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
const fixtureAtleta = {
    id_atleta: 9001,
    nombres: 'Atleta de prueba',
    apellidos: 'PDF completo 9001',
    estado: 'activo',
    cedula: 'V-99000001',
    cedula_heredada: false,
    fecha_nacimiento: '2013-05-11',
    telefono: '04140000001',
    direccion: 'Dirección sintética de prueba',
    alergias_medicas: 'Observación sintética. '.repeat(20),
    representante: {
        nombres: 'Representante sintético',
        apellidos: 'Prueba local',
        correo: 'representante@example.org',
        telefono1: '04140000002',
        cedula: 'V-99000002'
    },
    documentos: { foto_url: 'https://imagenes.invalid.example/foto-sintetica.png' }
};

let server;
let baseUrl;
let html2pdfBundle;
let pdfjsModule;
let pdfjsWorker;

test.before(async () => {
    [html2pdfBundle, pdfjsModule, pdfjsWorker] = await Promise.all([
        fs.readFile(html2pdfBundlePath),
        fs.readFile(pdfjsPath),
        fs.readFile(pdfjsWorkerPath)
    ]);

    server = http.createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/__test__/pdf.mjs') {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
            return res.end(pdfjsModule);
        }
        if (pathname === '/__test__/pdf.worker.mjs') {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
            return res.end(pdfjsWorker);
        }
        if (pathname.startsWith('/api/')) {
            if (pathname === '/api/auth/me') {
                return json(res, { success: true, usuario: {
                    id_usuario: 9, rol: 'directiva', nombres: 'Directiva', apellidos: 'Sintética'
                } });
            }
            if (pathname === '/api/directiva/auditoria') {
                return json(res, {
                    metricas: { activos: 0, espera: 0, pagos_pendientes: 0 },
                    tasa_bcv: 36.5, tasa_fecha: null, atletas: [], pagos: []
                });
            }
            if (pathname === '/api/atletas/9001') {
                return json(res, { success: true, atleta: fixtureAtleta });
            }
            return json(res, { success: true });
        }

        const filePath = path.resolve(publicRoot, '.' + decodeURI(pathname === '/' ? '/index.html' : pathname));
        if (!filePath.startsWith(publicRoot + path.sep)) {
            res.writeHead(403);
            return res.end();
        }
        try {
            const body = await fs.readFile(filePath);
            const type = {
                '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
            }[path.extname(filePath)] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
            res.end(body);
        } catch {
            res.writeHead(404);
            res.end('No encontrado');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});

function json(res, data) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

async function openDirectiva(viewport) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.route(
        'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
        route => route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: html2pdfBundle
        })
    );
    await page.goto(baseUrl + '/admin/panel-directiva.html');
    await page.waitForFunction(() => typeof window.verPlanilla === 'function');
    await page.evaluate(() => window.verPlanilla(9001));
    await page.locator('#planillaModal .planilla-toolbar button[onclick="descargarPlanillaPDF()"]')
        .waitFor({ state: 'visible' });
    return { browser, context, page, pageErrors };
}

async function agregarContenidoLargoSintetico(page) {
    await page.evaluate(() => {
        const root = document.getElementById('planilla-print-root');
        const section = document.createElement('section');
        section.className = 'planilla-section';
        const title = document.createElement('p');
        title.className = 'planilla-section-title';
        title.textContent = 'Historial sintético extenso para probar saltos de página';
        const table = document.createElement('table');
        table.className = 'planilla-table';
        for (let index = 1; index <= 48; index += 1) {
            const row = document.createElement('tr');
            const heading = document.createElement('th');
            heading.textContent = 'Registro sintético ' + index;
            const value = document.createElement('td');
            value.textContent = 'Contenido de prueba sin datos reales. '.repeat(2);
            row.append(heading, value);
            table.appendChild(row);
        }
        section.append(title, table);
        const finalMarker = document.createElement('div');
        finalMarker.textContent = 'MARCADOR FINAL SINTÉTICO';
        finalMarker.style.cssText = 'margin-top:8px;padding:10px;background:#ff00ff;color:#fff;font-weight:bold;';
        root.append(section, finalMarker);
    });
}

async function inspectPdfInBrowser(page, bytes) {
    return page.evaluate(async ({ baseUrl, bytes }) => {
        const pdfjs = await import(baseUrl + '/__test__/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = baseUrl + '/__test__/pdf.worker.mjs';
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const pdfPage = await pdf.getPage(pageNumber);
            const viewport = pdfPage.getViewport({ scale: 1 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d', { willReadFrequently: true });
            await pdfPage.render({ canvasContext: context, viewport }).promise;
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let magentaPixels = 0;
            let minContentX = canvas.width;
            let maxContentX = -1;
            for (let index = 0; index < pixels.length; index += 4) {
                if (pixels[index] > 210 && pixels[index + 1] < 90 && pixels[index + 2] > 210) {
                    magentaPixels += 1;
                }
                if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) {
                    const x = (index / 4) % canvas.width;
                    minContentX = Math.min(minContentX, x);
                    maxContentX = Math.max(maxContentX, x);
                }
            }
            pages.push({ width: canvas.width, height: canvas.height, magentaPixels, minContentX, maxContentX });
        }
        await pdf.destroy();
        return pages;
    }, { baseUrl, bytes: Array.from(bytes) });
}

for (const device of [
    { name: 'escritorio', viewport: { width: 1440, height: 900 } },
    { name: 'móvil', viewport: { width: 390, height: 844 } }
]) {
    test('la planilla PDF conserva todo el contenido y pagina en ' + device.name, async () => {
        const { browser, context, page } = await openDirectiva(device.viewport);
        try {
            await agregarContenidoLargoSintetico(page);
            const button = page.locator('#planillaModal .planilla-toolbar button[onclick="descargarPlanillaPDF()"]');
            const downloadPromise = page.waitForEvent('download');
            await button.click();
            const download = await downloadPromise;
            assert.match(download.suggestedFilename(), /^Planilla_Jaguares_Atleta_de_prueba_PDF_completo_9001\.pdf$/);
            assert.equal(await button.isDisabled(), false, 'el botón se reactiva al completar la descarga');

            const filePath = await download.path();
            const pdfBytes = await fs.readFile(filePath);
            assert.ok(pdfBytes.byteLength > 10000, 'se descargó un PDF con contenido');
            const pages = await inspectPdfInBrowser(page, pdfBytes);
            assert.ok(pages.length >= 2, 'el contenido largo debe continuar en páginas siguientes');
            assert.ok(pages[0].minContentX < 60 && pages[0].maxContentX > pages[0].width - 60,
                'el PDF conserva el ancho de página sin recortar sus columnas');
            assert.ok(pages.at(-1).magentaPixels > 1000,
                'el contenido final aparece completo en la última página');
        } finally {
            await context.close();
            await browser.close();
        }
    });
}

for (const device of [
    { name: 'escritorio', viewport: { width: 1440, height: 900 } },
    { name: 'móvil', viewport: { width: 390, height: 844 } }
]) {
    test('la impresión de la planilla usa ancho A4 en ' + device.name, async () => {
        const { browser, context, page, pageErrors } = await openDirectiva(device.viewport);
        try {
            await page.evaluate(() => {
                const appendOriginal = document.body.appendChild.bind(document.body);
                document.body.appendChild = (element) => {
                    const appended = appendOriginal(element);
                    if (element.id === 'iframe-print-planilla') {
                        element.contentWindow.print = () => {
                            const doc = element.contentDocument;
                            const sheet = doc.querySelector('.planilla-sheet');
                            const body = sheet.querySelector('.planilla-body');
                            window.__jaguaresPrintLayout = {
                                viewport: element.contentWindow.innerWidth,
                                responsiveMobile: element.contentWindow.matchMedia('(max-width: 600px)').matches,
                                sheetWidth: sheet.getBoundingClientRect().width,
                                gridColumns: element.contentWindow.getComputedStyle(body).gridTemplateColumns,
                                representativePresent: sheet.textContent.includes('representante@example.org')
                            };
                        };
                    }
                    return appended;
                };
                window.imprimirPlanilla();
            });
            await page.waitForFunction(() => window.__jaguaresPrintLayout);
            const layout = await page.evaluate(() => window.__jaguaresPrintLayout);
            assert.ok(layout.viewport >= 790, 'el iframe no hereda el ancho del móvil');
            assert.equal(layout.responsiveMobile, false, 'la plantilla conserva su distribución A4');
            assert.ok(layout.sheetWidth >= 700, 'el ancho de la ficha cabe en la página A4');
            assert.equal(layout.representativePresent, true, 'la ficha conserva los datos al imprimir');
            assert.deepEqual(pageErrors, []);
        } finally {
            await page.evaluate(() => {
                document.getElementById('iframe-print-planilla')?.contentWindow?.onafterprint?.();
            });
            await context.close();
            await browser.close();
        }
    });
}
