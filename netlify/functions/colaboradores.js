const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
    const tenantId = decoded.tenantId;

    // GET — listar colaboradores do tenant
    if (event.httpMethod === 'GET') {
      const path = event.path || '';
      const idMatch = path.match(/colaboradores\/([^/]+)$/);

      if (idMatch) {
        const [user] = await sql`SELECT * FROM usuarios WHERE id = ${idMatch[1]} AND tenant_id = ${tenantId}`;
        if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Não encontrado' }) };
        const { senha_hash, ...safe } = user;
        return { statusCode: 200, headers, body: JSON.stringify(safe) };
      }

      const usuarios = await sql`
        SELECT id, nome, email, role, cpf, rg, cargo, departamento, turno,
               data_admissao, tipo_contrato, salario, telefone, endereco,
               estado_civil, sexo, data_nasc, ctps, pis, banco, agencia,
               conta, tipo_conta, chave_pix, facial_ativo, ativo, criado_em
        FROM usuarios
        WHERE tenant_id = ${tenantId} AND role = 'colaborador' AND ativo = true
        ORDER BY nome
      `;
      return { statusCode: 200, headers, body: JSON.stringify(usuarios) };
    }

    // POST — cadastrar colaborador
    if (event.httpMethod === 'POST') {
      if (!['superadmin','admin'].includes(decoded.role)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão' }) };
      }
      const data = JSON.parse(event.body);
      const senhaHash = await bcrypt.hash(data.senha || '123456', 10);

      const [novo] = await sql`
        INSERT INTO usuarios (
          tenant_id, nome, email, senha_hash, role,
          cpf, rg, data_nasc, sexo, estado_civil, telefone, endereco,
          cargo, departamento, data_admissao, tipo_contrato, turno, salario,
          ctps, pis, observacoes, banco, agencia, conta, tipo_conta, chave_pix,
          facial_ativo
        ) VALUES (
          ${tenantId}, ${data.nome}, ${data.email}, ${senhaHash}, 'colaborador',
          ${data.cpf||null}, ${data.rg||null}, ${data.data_nasc||null}, ${data.sexo||null},
          ${data.estado_civil||null}, ${data.telefone||null}, ${data.endereco||null},
          ${data.cargo||null}, ${data.departamento||null}, ${data.data_admissao||null},
          ${data.tipo_contrato||'CLT'}, ${data.turno||'08:00 - 17:00'}, ${data.salario||null},
          ${data.ctps||null}, ${data.pis||null}, ${data.observacoes||null},
          ${data.banco||null}, ${data.agencia||null}, ${data.conta||null},
          ${data.tipo_conta||null}, ${data.chave_pix||null}, ${data.facial_ativo||false}
        )
        RETURNING id, nome, email, role, cargo, turno, cpf
      `;
      return { statusCode: 201, headers, body: JSON.stringify(novo) };
    }

    // PUT — atualizar colaborador
    if (event.httpMethod === 'PUT') {
      const data = JSON.parse(event.body);
      const path = event.path || '';
      const idMatch = path.match(/colaboradores\/([^/]+)$/);
      if (!idMatch) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID necessário' }) };

      await sql`
        UPDATE usuarios SET
          nome = ${data.nome}, cargo = ${data.cargo}, departamento = ${data.departamento},
          turno = ${data.turno}, telefone = ${data.telefone}, endereco = ${data.endereco},
          banco = ${data.banco}, agencia = ${data.agencia}, conta = ${data.conta},
          tipo_conta = ${data.tipo_conta}, chave_pix = ${data.chave_pix},
          observacoes = ${data.observacoes}
        WHERE id = ${idMatch[1]} AND tenant_id = ${tenantId}
      `;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  } catch (err) {
    console.error(err);
    const status = err.name === 'JsonWebTokenError' ? 401 : 500;
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
