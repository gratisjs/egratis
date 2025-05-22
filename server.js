// server.js

const express = require('express');
const mysql = require('mysql2/promise'); // Usamos la versión con Promises para un manejo más moderno
const cors = require('cors'); // Para permitir peticiones desde tu frontend

const app = express();
// El puerto donde correrá tu API. Render inyectará su propio puerto en process.env.PORT
const port = process.env.PORT || 3000; 

// --- CONFIGURACIÓN DE CORS (Cross-Origin Resource Sharing) ---
// Esto es VITAL cuando tu frontend y backend están en dominios diferentes.
// Permite que tu frontend haga peticiones a tu API.
// Asegúrate de que la URL de 'origin' sea EXACTA a la URL de tu frontend en Hostinger.
const corsOptions = {
    origin: 'https://blue-dunlin-336418.hostingersite.com' // ¡ESTA ES LA URL DE TU FRONTEND!
};
app.use(cors(corsOptions));
// -------------------------------------------------------------

// Middleware para parsear el cuerpo de las peticiones JSON (necesario para POST, PUT, DELETE)
app.use(express.json());

// --- CONFIGURACIÓN DE LA CONEXIÓN A TU BASE DE DATOS MySQL ---
// ¡¡IMPORTANTE!! Las credenciales se leerán de las variables de entorno de Render.
// NO codifiques tus credenciales de base de datos directamente aquí en producción.
const dbConfig = {
    host: process.env.DB_DATABASE,         // Variable de entorno de Render
    user: process.env.DB_HOST,         // Variable de entorno de Render
    password: process.env.DB_PASSWORD, // Variable de entorno de Render
    database: process.env.DB_PORT 
     database: process.env.DB_USER // Variable de entorno de Render
};

let dbPool; // Usaremos un pool de conexiones para mayor eficiencia y rendimiento

// Función para crear un pool de conexiones a la base de datos
async function createDatabasePool() {
    try {
        const pool = mysql.createPool(dbConfig); // Crea un pool de conexiones
        // Intentar una conexión para verificar que las credenciales son correctas
        const connection = await pool.getConnection();
        connection.release(); // Liberar la conexión inmediatamente
        console.log('Pool de conexiones a la base de datos creado correctamente.');
        return pool;
    } catch (error) {
        console.error('Error al crear el pool de conexiones:', error.message);
        console.error('Verifique las variables de entorno de la base de datos en Render (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).');
        console.error('Asegúrese de que la base de datos MySQL en Hostinger esté accesible desde Render y que las credenciales sean correctas.');
        throw error; // Lanzar el error para que la aplicación no intente iniciar sin DB
    }
}

// Inicializar el pool al inicio de la aplicación
(async () => {
    try {
        dbPool = await createDatabasePool();
    } catch (error) {
        // Si el pool no se pudo crear, registramos el error pero permitimos que Express siga escuchando.
        // Las rutas de la API que necesiten DB fallarán si dbPool es null/undefined.
        console.error('La aplicación no pudo conectar a la base de datos al inicio. Las rutas de la API que dependan de la DB fallarán.');
    }
})();


// ----------------------------------------------------------------
// RUTAS DE LA API (Endpoints para EXTRAER DATOS - GET)
// ----------------------------------------------------------------

// Middleware para verificar la conexión a la base de datos en cada ruta
async function checkDbConnection(req, res, next) {
    if (!dbPool) {
        console.error('Error: dbPool no inicializado. La base de datos no está conectada.');
        return res.status(503).json({ message: 'Servicio no disponible: la base de datos no está conectada.' });
    }
    next();
}

// Aplicar el middleware de verificación de DB a todas las rutas que la necesiten
app.use(checkDbConnection); // Esto aplicará a TODAS las rutas definidas después de esta línea

// Ruta para obtener todos los profesores
app.get('/profesores', async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.execute('SELECT id, nombre, horas_segun_contrato, estado FROM profesor');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener profesores:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener profesores.' });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para buscar profesores por ID o nombre
app.get('/profesores/buscar', async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm) {
        return res.status(400).json({ message: 'El término de búsqueda (q) es requerido.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.execute(
            `SELECT id, nombre, horas_segun_contrato, estado FROM profesor
             WHERE id = ? OR nombre LIKE ?`,
            [searchTerm, `%${searchTerm}%`]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No se encontraron profesores con ese término de búsqueda.' });
        }

        res.json(rows);
    } catch (error) {
        console.error('Error al buscar profesores:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al buscar profesores.' });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para obtener un profesor por ID
app.get('/profesores/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.execute('SELECT id, nombre, horas_segun_contrato, estado FROM profesor WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Profesor no encontrado.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener profesor por ID:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener profesor.' });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para obtener todas las asistencias con detalles del profesor (JOIN)
app.get('/asistencias', async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        const query = `
            SELECT
                a.id,
                a.fecha,
                a.horas,
                a.tardanza,
                a.justificacion,
                a.estado,
                p.nombre AS nombre_profesor,
                p.id AS id_profesor
            FROM asistencia a
            JOIN profesor p ON a.id_profesor = p.id
            ORDER BY a.fecha DESC;
        `;
        const [rows] = await connection.execute(query);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener asistencias:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener asistencias.' });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para obtener horarios de un profesor específico
app.get('/horarios/profesor/:id_profesor', async (req, res) => {
    const { id_profesor } = req.params;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.execute('SELECT * FROM horario WHERE id_profesor = ? ORDER BY hora_entrada', [id_profesor]);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener horarios del profesor:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener horarios.' });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para obtener todos los feriados
app.get('/feriados', async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.execute('SELECT * FROM feriados ORDER BY fecha ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener feriados:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener feriados.' });
    } finally {
        if (connection) connection.release();
    }
});


// ----------------------------------------------------------------
// RUTAS DE LA API (Endpoints para INSERCIÓN - POST)
// ----------------------------------------------------------------

// Ruta para insertar un nuevo profesor
app.post('/profesores', async (req, res) => {
    const { id, nombre, horas_segun_contrato, estado } = req.body;
    const fecha_registro = new Date().toISOString().slice(0, 10);
    const fecha_modificacion = fecha_registro;

    if (!id || !nombre) {
        return res.status(400).json({ message: 'El ID y el nombre del profesor son obligatorios.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO profesor (id, nombre, horas_segun_contrato, estado, fecha_registro, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?)',
            [id, nombre, horas_segun_contrato, estado, fecha_registro, fecha_modificacion]
        );
        res.status(201).json({ message: 'Profesor insertado con éxito', id: id, affectedRows: result.affectedRows });
    } catch (error) {
        console.error('Error al insertar profesor:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: 'Error: El ID del profesor ya existe.', error: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al insertar profesor.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para insertar una nueva asistencia
app.post('/asistencias', async (req, res) => {
    const { id, id_profesor, fecha, horas, tardanza, justificacion, estado } = req.body;
    const fecha_registro = new Date().toISOString().slice(0, 10);
    const fecha_modificacion = fecha_registro;

    if (!id || !id_profesor || !fecha || !horas) {
        return res.status(400).json({ message: 'ID, ID Profesor, Fecha y Horas de asistencia son obligatorios.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO asistencia (id, id_profesor, fecha, horas, tardanza, justificacion, estado, fecha_registro, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, id_profesor, fecha, horas, tardanza, justificacion, estado, fecha_registro, fecha_modificacion]
        );
        res.status(201).json({ message: 'Asistencia registrada con éxito', id: id, affectedRows: result.affectedRows });
    } catch (error) {
        console.error('Error al registrar asistencia:', error.message);
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
            return res.status(400).json({ message: 'Error: El ID del profesor no existe.', error: error.message });
        }
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: 'Error: La ID de asistencia ya existe.', error: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al registrar asistencia.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para insertar un nuevo feriado
app.post('/feriados', async (req, res) => {
    const { id, fecha, descripcion, estado } = req.body;
    const fecha_registro = new Date().toISOString().slice(0, 10);
    const fecha_modificacion = fecha_registro;

    if (!id || !fecha || !descripcion) {
        return res.status(400).json({ message: 'ID, Fecha y Descripción del feriado son obligatorios.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO feriados (id, fecha, descripcion, estado, fecha_registro, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?)',
            [id, fecha, descripcion, estado, fecha_registro, fecha_modificacion]
        );
        res.status(201).json({ message: 'Feriado insertado con éxito', id: id, affectedRows: result.affectedRows });
    } catch (error) {
        console.error('Error al insertar feriado:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: 'Error: La ID del feriado ya existe.', error: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al insertar feriado.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para insertar un nuevo horario
app.post('/horarios', async (req, res) => {
    const { id, id_profesor, hora_entrada, hora_salida, estado } = req.body;
    const fecha_registro = new Date().toISOString().slice(0, 10);
    const fecha_modificacion = fecha_registro;

    if (!id || !id_profesor || !hora_entrada || !hora_salida) {
        return res.status(400).json({ message: 'ID, ID Profesor, Hora de Entrada y Hora de Salida son obligatorios.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO horario (id, id_profesor, hora_entrada, hora_salida, estado, fecha_registro, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, id_profesor, hora_entrada, hora_salida, estado, fecha_registro, fecha_modificacion]
        );
        res.status(201).json({ message: 'Horario insertado con éxito', id: id, affectedRows: result.affectedRows });
    } catch (error) {
        console.error('Error al insertar horario:', error.message);
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
            return res.status(400).json({ message: 'Error: El ID del profesor no existe.', error: error.message });
        }
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: 'Error: La ID de horario ya existe.', error: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al insertar horario.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// ----------------------------------------------------------------
// RUTAS PARA ACTUALIZAR (PUT) Y ELIMINAR (DELETE)
// ----------------------------------------------------------------

// Ruta para actualizar un profesor
app.put('/profesores/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, horas_segun_contrato, estado } = req.body;
    const fecha_modificacion = new Date().toISOString().slice(0, 10);

    if (!nombre && !horas_segun_contrato && !estado) {
        return res.status(400).json({ message: 'Se requiere al menos un campo (nombre, horas_segun_contrato, o estado) para actualizar.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'UPDATE profesor SET nombre = ?, horas_segun_contrato = ?, estado = ?, fecha_modificacion = ? WHERE id = ?',
            [nombre, horas_segun_contrato, estado, fecha_modificacion, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Profesor no encontrado para actualizar.' });
        }
        res.json({ message: 'Profesor actualizado con éxito', affectedRows: result.affectedRows });
    } catch (error) {
        console.error('Error al actualizar profesor:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al actualizar profesor.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Ruta para eliminar un profesor
app.delete('/profesores/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute('DELETE FROM profesor WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Profesor no encontrado para eliminar.' });
        }
        res.json({ message: 'Profesor eliminado con éxito', affectedRows: result.affectedRows });
    } catch (error) {
        console.error('Error al eliminar profesor:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al eliminar profesor.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});


// ----------------------------------------------------------------
// INICIO DEL SERVIDOR
// ----------------------------------------------------------------

app.listen(port, () => {
    console.log(`API escuchando en el puerto ${port}`);
    console.log(`Para acceder a la API, usa la URL de Render (ej: https://egratis.onrender.com).`);
    console.log('Rutas disponibles: /profesores, /profesores/buscar, /profesores/:id, /asistencias, etc.');
});

// Manejo de errores de conexión de la base de datos para cerrar el pool al apagar la aplicación
process.on('SIGINT', async () => {
    if (dbPool) {
        await dbPool.end();
        console.log('Pool de conexiones a la base de datos cerrado.');
    }
    process.exit(0);
});
