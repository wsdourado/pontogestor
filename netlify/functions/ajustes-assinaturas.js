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
    const sql = neon(process.env.DATABASE_URL);
    const path = event.path || '';

    // ── AJUSTES ──
    if (path.includes('ajustes')) {
      if (event.httpMethod === 'GET') {
        const ajustes = await sql`
          SELECT a.*, u.nome as usuario_nome FROM ajustes_ponto a
          JOIN usuarios u ON u.id = a.usuario_id
          WHERE a.tenant_id = ${decoded.tenantId}
          ORDER BY a.criado_em DESC
        `;
        return { statusCode: 200, headers, body: JSON.stringify(ajustes) };
      }

      if (event.httpMethod === 'POST') {
        const { data_ajuste, hora_ajuste, tipo, motivo } = JSON.parse(event.body);
        const [aj] = await sql`
          INSERT INTO ajustes_ponto (usuario_id, tenant_id, data_ajuste, hora_ajuste, tipo, motivo)
          VALUES (${decoded.userId}, ${decoded.tenantId}, ${data_ajuste}, ${hora_ajuste}, ${tipo}, ${motivo})
          RETURNING *
        `;
        return { statusCode: 201, headers, body: JSON.stringify(aj) };
      }

      if (event.httpMethod === 'PUT') {
        const idMatch = path.match(/ajustes\/([^/]+)$/);
        const { status } = JSON.parse(event.body);
        if (!['aprovado','reprovado'].includes(status)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Status inválido' }) };
        }
        await sql`
          UPDATE ajustes_ponto SET status = ${status}, aprovado_por = ${decoded.userId}
          WHERE id = ${idMatch[1]} AND tenant_id = ${decoded.tenantId}
        `;
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    // ── ASSINATURAS ──
    if (path.includes('assinaturas')) {
      if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};
        const mes = params.mes || new Date().toISOString().slice(0, 7);
        const assinaturas = await sql`
          SELECT a.*, u.nome as usuario_nome FROM assinaturas a
          JOIN usuarios u ON u.id = a.usuario_id
          WHERE a.tenant_id = ${decoded.tenantId} AND a.mes_referencia = ${mes}
        `;
        return { statusCode: 200, headers, body: JSON.stringify(assinaturas) };
      }

      if (event.httpMethod === 'POST') {
        const { usuario_id, tipo, mes_referencia } = JSON.parse(event.body);
        const ip = event.headers['x-forwarded-for'] || '—';
        const agora = new Date();

        if (tipo === 'colab') {
          await sql`
            INSERT INTO assinaturas (usuario_id, tenant_id, mes_referencia, assinado_colab, data_assinatura_colab, ip_colab)
            VALUES (${usuario_id}, ${decoded.tenantId}, ${mes_referencia}, true, ${agora}, ${ip})
            ON CONFLICT (usuario_id, mes_referencia)
            DO UPDATE SET assinado_colab = true, data_assinatura_colab = ${agora}, ip_colab = ${ip}
          `;
        } else {
          await sql`
            UPDATE assinaturas SET assinado_sup = true, data_assinatura_sup = ${agora}, ip_sup = ${ip}, supervisor_id = ${decoded.userId}
            WHERE usuario_id = ${usuario_id} AND mes_referencia = ${mes_referencia} AND tenant_id = ${decoded.tenantId}
          `;
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Rota não encontrada' }) };
  } catch (err) {
    console.error(err);
    const status = err.name === 'JsonWebTokenError' ? 401 : 500;
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
