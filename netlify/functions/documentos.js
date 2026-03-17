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

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const usuarioId = params.usuario_id;
      const mes = params.mes;

      let docs;
      if (usuarioId) {
        docs = await sql`
          SELECT d.*, u.nome as usuario_nome FROM documentos d
          JOIN usuarios u ON u.id = d.usuario_id
          WHERE d.tenant_id = ${decoded.tenantId} AND d.usuario_id = ${usuarioId}
          ORDER BY d.data_documento DESC
        `;
      } else if (mes) {
        docs = await sql`
          SELECT d.*, u.nome as usuario_nome FROM documentos d
          JOIN usuarios u ON u.id = d.usuario_id
          WHERE d.tenant_id = ${decoded.tenantId} AND d.mes_referencia = ${mes}
          ORDER BY d.data_documento DESC
        `;
      } else {
        docs = await sql`
          SELECT d.*, u.nome as usuario_nome FROM documentos d
          JOIN usuarios u ON u.id = d.usuario_id
          WHERE d.tenant_id = ${decoded.tenantId}
          ORDER BY d.data_documento DESC
        `;
      }
      return { statusCode: 200, headers, body: JSON.stringify(docs) };
    }

    if (event.httpMethod === 'POST') {
      const { usuario_id, tipo, descricao, data_documento, mes_referencia, nome_arquivo, tamanho_kb } = JSON.parse(event.body);
      const [doc] = await sql`
        INSERT INTO documentos (usuario_id, tenant_id, tipo, descricao, data_documento, mes_referencia, nome_arquivo, tamanho_kb)
        VALUES (${usuario_id}, ${decoded.tenantId}, ${tipo}, ${descricao}, ${data_documento||null}, ${mes_referencia||null}, ${nome_arquivo||null}, ${tamanho_kb||null})
        RETURNING *
      `;
      return { statusCode: 201, headers, body: JSON.stringify(doc) };
    }

    if (event.httpMethod === 'DELETE') {
      const path = event.path || '';
      const idMatch = path.match(/documentos\/([^/]+)$/);
      if (!idMatch) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID necessário' }) };
      await sql`DELETE FROM documentos WHERE id = ${idMatch[1]} AND tenant_id = ${decoded.tenantId}`;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  } catch (err) {
    console.error(err);
    const status = err.name === 'JsonWebTokenError' ? 401 : 500;
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
