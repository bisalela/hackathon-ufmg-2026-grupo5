-- 1. Perfis de Usuário (Auth & Role)
create table perfis (
  id uuid references auth.users(id) on delete cascade primary key,
  nome text not null,
  tipo_usuario text check (tipo_usuario in ('advogado', 'adm')) not null,
  created_at timestamptz default now()
);

-- 2. Clientes (Banco UFMG)
create table clientes (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  created_at timestamptz default now()
);

-- 3. Processos (Workflow Central)
create table processos (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references clientes(id) on delete cascade,
  adm_id uuid references perfis(id) not null,
  advogado_id uuid references perfis(id) not null,
  nome_pasta text not null,
  
  -- Workflow atualizado (Sem 'nascimento')
  status text check (status in (
    'novo_processo', 
    'triagem_ia', 
    'analise_advogado', 
    'aguardando_sentenca', 
    'julgado'
  )) default 'novo_processo',
  
  sugestao_aprovada boolean,
  comentario_advogado text,
  
  -- Indicadores Financeiros (Requisito 5 do Edital)
  valor_causa numeric(12,2) default 0.00,
  valor_decisao_juiz numeric(12,2) default 0.00,
  economia_gerada numeric(12,2) generated always as (valor_causa - valor_decisao_juiz) stored,
  
  data_criacao timestamptz default now(),
  data_ultima_edicao timestamptz default now()
);

-- 4. Documentos (Caminho para o Storage)
create table documentos (
  id uuid default gen_random_uuid() primary key,
  processo_id uuid references processos(id) on delete cascade,
  tipo_documento text,
  nome_arquivo text not null,
  caminho_storage text not null,
  data_upload timestamptz default now()
);

-- 5. Análises dos Agentes (Output da IA)
create table analises_agentes (
  id uuid default gen_random_uuid() primary key,
  processo_id uuid references processos(id) on delete cascade unique,
  resultado_agentes jsonb not null, 
  data_analise timestamptz default now()
);

-- CONFIGURAÇÃO DO STORAGE (Buckets e Policies)
insert into storage.buckets (id, name, public)
values ('documentos_processuais', 'documentos_processuais', true)
on conflict (id) do nothing;

create policy "allow anon upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'documentos_processuais');
create policy "allow anon read" on storage.objects for select to anon, authenticated using (bucket_id = 'documentos_processuais');
