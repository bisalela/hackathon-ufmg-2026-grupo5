# Setup e Execucao

Este projeto possui 3 partes principais:

1. `src/frontend/frontend/ML/frontend`
Frontend React + Vite usado pelo advogado/ADM.
2. `src/AI_Agent_Enter`
Backend em Node.js/TypeScript que integra OpenAI, Supabase e os scripts Python.
3. `Supabase`
Banco, storage e tabelas para processos, documentos e analises.

## Visao Geral da Execucao

Para a solucao funcionar de ponta a ponta, voce precisa:

1. Criar e configurar um projeto no Supabase.
2. Executar o schema SQL em `docs/database_schema.sql`.
3. Criar os arquivos de ambiente do frontend e do backend.
4. Instalar as dependencias de Node.js e Python.
5. Subir o backend.
6. Subir o frontend.

## Pre-requisitos

Recomendado para desenvolvimento:

- Node.js 20 LTS
- npm 10+
- Python 3.10+ com `venv`
- Conta/projeto no Supabase
- Chave da OpenAI valida

Opcional:

- `pdflatex` para gerar PDF localmente
- acesso externo a uma API de compilacao LaTeX caso nao queira instalar LaTeX local

## Estrutura Relevante

```text
.
├── SETUP.md
├── .env.example
├── docs/
│   └── database_schema.sql
├── src/
│   ├── AI_Agent_Enter/                 # backend + integracao Python
│   └── frontend/frontend/ML/frontend/  # frontend React
```

## 1. Configuracao do Supabase

### 1.1 Criar o projeto

Crie um projeto no Supabase e anote:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### 1.2 Executar o schema

No SQL Editor do Supabase, execute o arquivo:

```text
docs/database_schema.sql
```

Esse script cria:

- tabela `perfis`
- tabela `clientes`
- tabela `processos`
- tabela `documentos`
- tabela `analises_agentes`
- bucket `documentos_processuais`

### 1.3 Criar usuarios base no Auth

Como a tabela `perfis` referencia `auth.users(id)`, crie pelo menos 3 usuarios no painel do Supabase em `Authentication > Users`:

- 1 usuario ADM
- 2 usuarios ADVOGADO

Exemplo de emails:

- `admin@enteros.ai`
- `advogado1@enteros.ai`
- `advogado2@enteros.ai`

### 1.4 Popular tabelas iniciais

Depois de criar os usuarios no Auth, rode um SQL semelhante ao abaixo no Supabase:

```sql
insert into clientes (nome)
values ('Banco UFMG');

insert into perfis (id, nome, tipo_usuario)
select id, 'Administrador', 'adm'
from auth.users
where email = 'admin@enteros.ai'
on conflict (id) do nothing;

insert into perfis (id, nome, tipo_usuario)
select id, 'Advogado 1', 'advogado'
from auth.users
where email = 'advogado1@enteros.ai'
on conflict (id) do nothing;

insert into perfis (id, nome, tipo_usuario)
select id, 'Advogado 2', 'advogado'
from auth.users
where email = 'advogado2@enteros.ai'
on conflict (id) do nothing;
```

Sem esses registros o painel abre, mas o fluxo de criacao de processos nao funciona corretamente.

## 2. Variaveis de Ambiente

O arquivo `.env.example` na raiz serve como referencia, mas a aplicacao usa 2 arquivos separados:

- `src/AI_Agent_Enter/.env`
- `src/frontend/frontend/ML/frontend/.env`

### 2.1 Backend

Crie o arquivo `src/AI_Agent_Enter/.env`:

```env
OPENAI_API_KEY=sua_chave_openai
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
PORT=3001
AGENT_FRONTEND_ORIGIN=http://localhost:5173
```

Variaveis opcionais do backend:

```env
# Forca um interpretador Python especifico
AGENT_PYTHON_BIN=/caminho/absoluto/para/python

# Liga logs extras de depuracao
AGENT_DEBUG_LOG=0

# Ativa prechecagem de documentos obrigatorios
AGENT_ENABLE_PRECHECK=0

# Bucket do Supabase para relatórios
AGENT_REPORTS_BUCKET=documentos_processuais

# API externa para compilar LaTeX em PDF
LATEX_COMPILE_API_URL=https://latexonline.cc
```

Observacao:
Se existir `src/AI_Agent_Enter/venv/bin/python`, o backend tenta usa-lo automaticamente.

### 2.2 Frontend

Crie o arquivo `src/frontend/frontend/ML/frontend/.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
VITE_AGENT_API_URL=http://localhost:3001/agent
```

Importante:

- use a chave anon/publishable no frontend
- nunca use `SERVICE ROLE` no frontend

## 3. Instalacao das Dependencias

Nao existe um `package.json` na raiz. A instalacao deve ser feita separadamente em cada parte do projeto.

### 3.1 Backend Node.js

```bash
cd src/AI_Agent_Enter
npm install
```

### 3.2 Frontend React

```bash
cd src/frontend/frontend/ML/frontend
npm install
```

### 3.3 Ambiente Python do backend

O backend chama scripts Python para predicao e apoio a analise.

```bash
cd src/AI_Agent_Enter
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install openai python-dotenv pypdf pandas joblib numpy shap
```

Dependencias Python opcionais para retreino do modelo:

```bash
pip install scikit-learn catboost
```

Observacoes:

- para apenas rodar a solucao, `scikit-learn` e `catboost` nao sao obrigatorios
- `shap` e usado para transparencia do modelo; se nao estiver disponivel, o codigo cai em um fallback com `feature_importances_`

## 4. Como Rodar a Solucao

Abra 2 terminais.

### Terminal 1: backend

```bash
cd src/AI_Agent_Enter
npm run dev
```

Saida esperada:

```text
AI Agent backend listening on http://localhost:3001
```

### Terminal 2: frontend

```bash
cd src/frontend/frontend/ML/frontend
npm run dev
```

O Vite normalmente sobe em:

```text
http://localhost:5173
```

## 5. Fluxo de Uso da Aplicacao

Depois de subir frontend e backend:

1. Acesse `http://localhost:5173`
2. Faça login com:

```text
email: demo@enteros.ai
senha: 123
```

3. No painel, alterne o perfil para `Admin`
4. Crie um processo
5. Envie arquivos `.pdf` e/ou `.csv`
6. Execute o `AI Agent`
7. Revise a analise no dashboard

Observacao:
O login atual do frontend e local/mockado para demonstracao. Mesmo assim, o Supabase precisa estar configurado porque os dados do dashboard, uploads e analises sao lidos/escritos nele.

## 6. Geracao de Relatorios

O backend sempre gera o `.tex` do relatorio.

Para PDF, existem 2 cenarios:

### Opcao A: gerar PDF localmente

Instale `pdflatex` no sistema. Quando disponivel, o backend tenta gerar:

```text
src/AI_Agent_Enter/reports/<processoId>/relatorio.pdf
```

### Opcao B: usar compilacao externa

Defina `LATEX_COMPILE_API_URL` no backend para um servico de compilacao LaTeX.

Padrao atual:

```text
https://latexonline.cc
```

## 7. Troubleshooting

### Erro de conexao com o backend no frontend

Verifique:

- se o backend esta rodando na porta `3001`
- se `VITE_AGENT_API_URL` aponta para `http://localhost:3001/agent`

### Erro de variavel do Supabase no frontend

Verifique:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Nao use chave `sb_secret` no frontend.

### Erro ao criar processo

Verifique se existem no Supabase:

- 1 registro em `clientes`
- 1 perfil com `tipo_usuario = 'adm'`
- pelo menos 1 perfil com `tipo_usuario = 'advogado'`

### Erro de Python nao encontrado

Se o backend nao localizar o Python automaticamente, defina:

```env
AGENT_PYTHON_BIN=/caminho/absoluto/para/python
```

### Erro na geracao de PDF

Se `pdflatex` nao estiver instalado, o `.tex` ainda sera gerado normalmente. Para PDF:

- instale uma distribuicao LaTeX com `pdflatex`
- ou configure `LATEX_COMPILE_API_URL`

## 8. Comandos Rapidos

### Instalar tudo

```bash
cd src/AI_Agent_Enter
npm install
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install openai python-dotenv pypdf pandas joblib numpy shap
```

```bash
cd src/frontend/frontend/ML/frontend
npm install
```

### Rodar tudo

```bash
cd src/AI_Agent_Enter
npm run dev
```

```bash
cd src/frontend/frontend/ML/frontend
npm run dev
```

## 9. Dados

Os dados sensiveis nao devem ser versionados. Consulte tambem:

```text
data/README.md
```

O `.gitignore` do projeto ja ignora:

- `.env`
- `node_modules`
- `venv`
- `src/AI_Agent_Enter/reports`
- arquivos de dados sensiveis
