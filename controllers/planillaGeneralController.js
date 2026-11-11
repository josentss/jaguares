'use strict';

const db = require('../config/db');
const { CATEGORIAS, clasificar, hoyCaracasISO } = require('../public/admin/categorias-formativas');

// Solo datos necesarios para esta planilla. La clasificación se calcula con el
// mismo día civil para todas las filas, incluso si la petición cruza medianoche.
exports.obtener = async (req, res) => {
    const codigo = req.query.categoria;
    const categoria = CATEGORIAS.find(item => item.codigo === codigo);
    if (typeof codigo !== 'string' || !categoria || Object.keys(req.query).some(key => key !== 'categoria')) {
        return res.status(400).json({ success: false, message: 'Selecciona una categoría publicada' });
    }
    try {
        const hoy = hoyCaracasISO();
        const resultado = await db.pool.query(`
            SELECT nombres, apellidos, cedula, fecha_nacimiento
            FROM atletas
            WHERE estado = $1
            ORDER BY apellidos, nombres, id_atleta
        `, ['activo']);
        const atletas = resultado.rows.filter(atleta =>
            clasificar(atleta.fecha_nacimiento, hoy).categoria?.codigo === codigo
        ).map(({ nombres, apellidos, cedula, fecha_nacimiento }) => ({
            nombres, apellidos, cedula, fecha_nacimiento
        }));
        if (atletas.length > 1000) {
            return res.status(413).json({ success: false,
                message: 'La categoría supera el límite de 1000 atletas para una planilla' });
        }
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, categoria: { codigo, nombre: categoria.nombre },
            fecha: hoy, total: atletas.length, atletas });
    } catch (error) {
        console.error('Error al consultar planilla general:', error.code || 'INTERNAL');
        return res.status(500).json({ success: false, message: 'No se pudo consultar la planilla general' });
    }
};
