const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pontogestor-secret-2025';

function verifyToken(event) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) throw new Error('Token não fornecido');
  return jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const decoded = verifyToken(event);
    const sql = neon(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);

    // GET — buscar registros
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const usuarioId = params.usuario_id || decoded.userId;
      const data = params.data || new Date().toISOString().split('T')[0];
      const mes = params.mes;

      if (mes) {
        // Registros do mês para espelho de ponto
        const regs = await sql`
          SELECT r.*, u.nome as usuario_nome, u.turno
          FROM registros_ponto r
          JOIN usuarios u ON u.id = r.usuario_id
          WHERE r.tenant_id = ${decoded.tenantId}
            AND (${usuarioId === 'todos' ? sql`1=1` : sql`r.usuario_id = ${usuarioId}`})
            AND DATE_TRUNC('month', r.registrado_em) = DATE_TRUNC('month', ${mes + '-01'}::date)
          ORDER BY r.registrado_em
        `;
        return { statusCode: 200, headers, body: JSON.stringify(regs) };
      }

      // Registros do dia
      const regs = await sql`
        SELECT r.*, u.nome as usuario_nome, u.turno
        FROM registros_ponto r
        JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.tenant_id = ${decoded.tenantId}
          AND r.usuario_id = ${usuarioId}
          AND DATE(r.registrado_em) = ${data}::date
        ORDER BY r.registrado_em
      `;
      return { statusCode: 200, headers, body: JSON.stringify(regs) };
    }

    // POST — bater ponto
    if (event.httpMethod === 'POST') {
      const { tipo, facial_ok, fora_cerca, latitude, longitude } = JSON.parse(event.body);
      const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || '—';

      const [reg] = await sql`
        INSERT INTO registros_ponto (usuario_id, tenant_id, tipo, facial_ok, fora_cerca, latitude, longitude, ip_address)
        VALUES (${decoded.userId}, ${decoded.tenantId}, ${tipo}, ${facial_ok||false}, ${fora_cerca||false}, ${latitude||null}, ${longitude||null}, ${ip})
        RETURNING *
      `;
      return { statusCode: 201, headers, body: JSON.stringify(reg) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  } catch (err) {
    console.error(err);
    const status = err.name === 'JsonWebTokenError' ? 401 : 500;
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
