const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pontogestor-secret-2025';

function verifyToken(event) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) throw new Error('Token não fornecido');
  const token = auth.replace('Bearer ', '');
  return jwt.verify(token, JWT_SECRET);
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
    const sql = neon(process.env.DATABASE_URL);

    // GET — listar tenants (superadmin) ou retornar o próprio tenant
    if (event.httpMethod === 'GET') {
      if (decoded.role === 'superadmin') {
        const tenants = await sql`
          SELECT t.*, COUNT(u.id) FILTER (WHERE u.role = 'colaborador') as total_colaboradores
          FROM tenants t
          LEFT JOIN usuarios u ON u.tenant_id = t.id AND u.ativo = true
          GROUP BY t.id ORDER BY t.nome
        `;
        return { statusCode: 200, headers, body: JSON.stringify(tenants) };
      } else {
        const tenants = await sql`SELECT * FROM tenants WHERE id = ${decoded.tenantId}`;
        return { statusCode: 200, headers, body: JSON.stringify(tenants[0] || null) };
      }
    }

    // POST — criar tenant (superadmin)
    if (event.httpMethod === 'POST') {
      if (decoded.role !== 'superadmin') {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão' }) };
      }
      const { nome, cnpj, segmento, plano, raio_metros } = JSON.parse(event.body);
      const result = await sql`
        INSERT INTO tenants (nome, cnpj, segmento, plano, raio_metros)
        VALUES (${nome}, ${cnpj}, ${segmento}, ${plano || 'Pro'}, ${raio_metros || 500})
        RETURNING *
      `;
      return { statusCode: 201, headers, body: JSON.stringify(result[0]) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  } catch (err) {
    console.error(err);
    const status = err.name === 'JsonWebTokenError' ? 401 : 500;
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
