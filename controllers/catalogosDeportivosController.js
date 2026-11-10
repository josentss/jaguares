'use strict';

const db = require('../config/db');
const { esEnteroPositivo } = require('../utils/validators');

// Lista cerrada: los nombres de tablas/columnas nunca proceden de req.body.
const TIPOS = Object.freeze({
    temporadas: { tabla: 'temporadas_deportivas', pk: 'id_temporada', padre: null },
    categorias: { tabla: 'categorias_deportivas', pk: 'id_categoria', padre: 'id_temporada' },
    equipos: { tabla: 'equipos_deportivos', pk: 'id_equipo', padre: 'id_categoria' }
});

function nombreValido(valor) {
    if (typeof valor !== 'string' || /[\u0000-\u001f\u007f<>]/.test(valor)) return null;
    const nombre = valor.trim().replace(/ +/g, ' ');
    if (nombre.length < 2 || nombre.length > 80 ||
        !/^[\p{L}\p{N}][\p{L}\p{N} .,'’_/()+&–-]*$/u.test(nombre)) return null;
    return nombre;
}

function errorSQL(res, err) {
    if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'Ese nombre ya existe en el catálogo correspondiente' });
    }
    if (err.code === '23503') {
        return res.status(409).json({ success: false, message: 'La temporada o categoría seleccionada no existe' });
    }
    if (err.code === '42P01') {
        return res.status(503).json({ success: false, message: 'Catálogo no disponible: falta aplicar la migración deportiva' });
    }
    console.error('CATALOGOS_DEPORTIVOS_SQL', err.code || 'INTERNAL');
    return res.status(500).json({ success: false, message: 'No se pudo procesar el catálogo deportivo' });
}

exports.listar = async (_req, res) => {
    try {
        const [temporadas, categorias, equipos] = await Promise.all([
            db.pool.query('SELECT id_temporada, nombre FROM temporadas_deportivas ORDER BY nombre, id_temporada'),
            db.pool.query('SELECT id_categoria, id_temporada, nombre FROM categorias_deportivas ORDER BY nombre, id_categoria'),
            db.pool.query('SELECT id_equipo, id_categoria, nombre FROM equipos_deportivos ORDER BY nombre, id_equipo')
        ]);
        return res.json({
            success: true,
            temporadas: temporadas.rows,
            categorias: categorias.rows,
            equipos: equipos.rows
        });
    } catch (err) { return errorSQL(res, err); }
};

exports.crear = async (req, res) => {
    const tipo = TIPOS[req.params.tipo];
    if (!tipo) return res.status(404).json({ success: false, message: 'Catálogo no encontrado' });
    const nombre = nombreValido(req.body?.nombre);
    if (!nombre) return res.status(400).json({ success: false, message: 'Nombre inválido: 2–80 caracteres, sin etiquetas ni caracteres de control' });

    const valores = [nombre];
    let columnas = 'nombre';
    let marcadores = '$1';
    if (tipo.padre) {
        if (!esEnteroPositivo(req.body?.[tipo.padre])) {
            return res.status(400).json({ success: false, message: 'Selecciona una temporada o categoría válida' });
        }
        columnas += ', ' + tipo.padre;
        marcadores += ', $2';
        valores.push(Number(req.body[tipo.padre]));
    }
    try {
        const { rows } = await db.pool.query(
            `INSERT INTO ${tipo.tabla} (${columnas}) VALUES (${marcadores}) RETURNING ${tipo.pk}, nombre${tipo.padre ? ', ' + tipo.padre : ''}`,
            valores
        );
        return res.status(201).json({ success: true, registro: rows[0] });
    } catch (err) { return errorSQL(res, err); }
};

exports.renombrar = async (req, res) => {
    const tipo = TIPOS[req.params.tipo];
    if (!tipo) return res.status(404).json({ success: false, message: 'Catálogo no encontrado' });
    if (!esEnteroPositivo(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Identificador no válido' });
    }
    const nombre = nombreValido(req.body?.nombre);
    if (!nombre) return res.status(400).json({ success: false, message: 'Nombre inválido: 2–80 caracteres, sin etiquetas ni caracteres de control' });
    try {
        const { rows } = await db.pool.query(
            `UPDATE ${tipo.tabla} SET nombre = $1 WHERE ${tipo.pk} = $2 RETURNING ${tipo.pk}, nombre`,
            [nombre, Number(req.params.id)]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
        return res.json({ success: true, registro: rows[0] });
    } catch (err) { return errorSQL(res, err); }
};
