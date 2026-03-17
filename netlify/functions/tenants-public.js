const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };

  try {
    const sql = neon(process.env.DATABASE_URL);
    const tenants = await sql`
      SELECT id, nome, segmento FROM tenants WHERE ativo = true ORDER BY nome
    `;
    return { statusCode: 200, headers, body: JSON.stringify(tenants) };
  } catch (err) {
    console.error('Erro ao listar tenants:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao buscar empresas' }) };
  }
};
