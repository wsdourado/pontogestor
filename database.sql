-- =============================================
-- PONTOGESTOR — Script de criação do banco
-- Execute no Neon SQL Editor
-- =============================================

-- TENANTS (empresas)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL,
  cnpj VARCHAR(20),
  segmento VARCHAR(100),
  plano VARCHAR(50) DEFAULT 'Pro',
  ativo BOOLEAN DEFAULT true,
  raio_metros INT DEFAULT 500,
  lat DECIMAL(10,6),
  lng DECIMAL(10,6),
  horario_entrada TIME DEFAULT '08:00',
  horario_saida TIME DEFAULT '17:00',
  intervalo_min INT DEFAULT 60,
  facial_modo VARCHAR(50) DEFAULT 'alerta',
  criado_em TIMESTAMP DEFAULT NOW()
);

-- USUÁRIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin','admin','colaborador')),
  -- Dados pessoais
  cpf VARCHAR(20),
  rg VARCHAR(20),
  data_nasc DATE,
  sexo VARCHAR(20),
  estado_civil VARCHAR(30),
  telefone VARCHAR(20),
  endereco TEXT,
  -- Dados profissionais
  cargo VARCHAR(100),
  departamento VARCHAR(100),
  data_admissao DATE,
  tipo_contrato VARCHAR(30),
  turno VARCHAR(30) DEFAULT '08:00 - 17:00',
  salario DECIMAL(10,2),
  ctps VARCHAR(30),
  pis VARCHAR(30),
  observacoes TEXT,
  -- Dados bancários
  banco VARCHAR(100),
  agencia VARCHAR(20),
  conta VARCHAR(20),
  tipo_conta VARCHAR(20),
  chave_pix VARCHAR(100),
  -- Facial
  facial_ativo BOOLEAN DEFAULT false,
  foto_url TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- REGISTROS DE PONTO
CREATE TABLE IF NOT EXISTS registros_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('Entrada','Almoço - saída','Almoço - retorno','Saída')),
  registrado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  facial_ok BOOLEAN DEFAULT false,
  fora_cerca BOOLEAN DEFAULT false,
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  ip_address VARCHAR(50),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- DOCUMENTOS
CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  data_documento DATE,
  mes_referencia VARCHAR(7),
  nome_arquivo VARCHAR(255),
  tamanho_kb INT,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- AJUSTES DE PONTO
CREATE TABLE IF NOT EXISTS ajustes_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  data_ajuste DATE NOT NULL,
  hora_ajuste TIME NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  motivo TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado')),
  aprovado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ASSINATURAS DIGITAIS
CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  mes_referencia VARCHAR(7) NOT NULL,
  -- Colaborador
  assinado_colab BOOLEAN DEFAULT false,
  data_assinatura_colab TIMESTAMP,
  ip_colab VARCHAR(50),
  -- Supervisor
  assinado_sup BOOLEAN DEFAULT false,
  data_assinatura_sup TIMESTAMP,
  ip_sup VARCHAR(50),
  supervisor_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(usuario_id, mes_referencia)
);

-- =============================================
-- DADOS INICIAIS — Super Admin
-- Senha: admin123 (hash bcrypt)
-- =============================================
INSERT INTO usuarios (nome, email, senha_hash, role, tenant_id)
VALUES (
  'Weslei Brandão',
  'weslei@confiance.com.br',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'superadmin',
  NULL
) ON CONFLICT (email) DO NOTHING;

-- =============================================
-- ÍNDICES para performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros_ponto(usuario_id);
CREATE INDEX IF NOT EXISTS idx_registros_tenant ON registros_ponto(tenant_id);
CREATE INDEX IF NOT EXISTS idx_registros_data ON registros_ponto(registrado_em);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_docs_usuario ON documentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_tenant ON ajustes_ponto(tenant_id);
