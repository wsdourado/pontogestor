const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pontogestor-secret-2025';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const { email, senha, tenantId } = JSON.parse(event.body);

    if (!email || !senha) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'E-mail e senha são obrigatórios' }) };
    }

    const sql = neon(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);

    const users = await sql`
      SELECT u.*, t.nome as tenant_nome, t.cnpj as tenant_cnpj, t.segmento as tenant_segmento
      FROM usuarios u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ${email} AND u.ativo = true
      LIMIT 1
    `;

    if (!users.length) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'E-mail ou senha incorretos' }) };
    }

    const user = users[0];
    const senhaOk = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaOk) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'E-mail ou senha incorretos' }) };
    }

    if (user.role !== 'superadmin') {
      if (!tenantId || user.tenant_id !== tenantId) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Usuário não pertence a esta empresa' }) };
      }
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const { senha_hash, ...userSafe } = user;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        user: userSafe,
        tenant: user.tenant_id ? {
          id: user.tenant_id,
          nome: user.tenant_nome,
          cnpj: user.tenant_cnpj,
          segmento: user.tenant_segmento
        } : null
      })
    };
  } catch (err) {
    console.error('Erro no login:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno do servidor' }) };
  }
};
