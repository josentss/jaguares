'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const reglas = require('../public/admin/categorias-formativas');
const { esEdadAtletaValida } = require('../utils/validators');

test('las franjas de la portada son contiguas, sin solaparse y comienzan en cinco años', () => {
    const edadEsperada = [[5,7],[8,9],[10,11],[12,13],[14,15]];
    assert.deepEqual(reglas.CATEGORIAS.map(c=>[c.edadMin,c.edadMax]),edadEsperada);
    assert.deepEqual(reglas.CATEGORIAS.map(c=>c.codigo),['u7','u9','u11','u13','u15']);
    const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
    for(const c of reglas.CATEGORIAS) {
        const tarjeta = html.match(new RegExp('data-cat="'+c.codigo+'"[\\s\\S]*?<span class="card-age">([^<]+)</span>[\\s\\S]*?<h3>([^<]+)</h3>'));
        assert.ok(tarjeta,'Falta tarjeta pública '+c.codigo);
        assert.ok(tarjeta[1].includes(c.edadMin+'–'+c.edadMax),'Edades públicas distintas para '+c.codigo);
        assert.equal(tarjeta[2],c.nombre,'Nombre público distinto para '+c.codigo);
    }
});

test('fronteras exactas por cumpleaños y edad cumplida; ni año civil ni huso UTC cambian la categoría', () => {
    const hoy='2026-11-10';
    const casos=[
        ['2021-11-10','u7',5],
        ['2019-11-10','u7',7],
        ['2018-11-10','u9',8],
        ['2017-11-10','u9',9],
        ['2016-11-10','u11',10],
        ['2015-11-10','u11',11],
        ['2014-11-10','u13',12],
        ['2013-11-10','u13',13],
        ['2012-11-10','u15',14],
        ['2011-11-10','u15',15],
        ['2018-11-11','u7',7],
        ['2016-11-11','u9',9]
    ];
    for (const [nacimiento,codigo,edad] of casos) {
        const r=reglas.clasificar(nacimiento,hoy);
        assert.equal(r.categoria?.codigo,codigo,nacimiento);
        assert.equal(r.edad,edad,nacimiento);
        assert.equal(esEdadAtletaValida(nacimiento,hoy),true);
    }
});

test('U-15 no se asigna como elegibilidad deportiva sin validar modalidad masculina', () => {
    const r=reglas.clasificar('2012-02-01','2026-11-10');
    assert.equal(r.categoria.codigo,'u15');
    assert.equal(r.estado,'requiere_validacion');
    assert.match(r.mensaje,/masculina/);
});

test('16–18 años inscribibles no son asociados a categorías inexistentes en la portada', () => {
    for(const edad of [16,17,18]) {
        const nacimiento=String(2026-edad)+'-01-01';
        assert.equal(esEdadAtletaValida(nacimiento,'2026-11-10'),true);
        const r=reglas.clasificar(nacimiento,'2026-11-10');
        assert.equal(r.estado,'sin_categoria_publicada');
        assert.equal(r.categoria,null);
    }
});

test('fechas inválidas y edades fuera de rango se rechazan sin clasificar', () => {
    for (const nacimiento of ['2026-02-30','2027-01-01','hola','',null,'2022-01-01','2000-01-01']) {
        const r=reglas.clasificar(nacimiento,'2026-11-10');
        assert.equal(r.categoria,null,String(nacimiento));
        assert.ok(['fecha_invalida','fuera_rango_inscripcion'].includes(r.estado));
    }
});

test('el resultado no muta reglas ni fecha, y puede calcularse tras cambiar el día', () => {
    const antes=reglas.clasificar('2018-11-11','2026-11-10');
    const despues=reglas.clasificar('2018-11-11','2026-11-11');
    assert.equal(antes.categoria.codigo,'u7');
    assert.equal(despues.categoria.codigo,'u9');
    assert.equal(reglas.CATEGORIAS[1].edadMin,8);
    assert.equal(Object.isFrozen(reglas.CATEGORIAS),true);
});
