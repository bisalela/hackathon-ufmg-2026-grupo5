### 1. Alinhamento de Valor e Personas

Antes de irmos para a parte técnica, vamos amarrar como essa solução gera valor para as personas envolvidas (isso será ouro para o seu Pitch):

* **Persona 1: O Advogado Externo (Usuário Final):** O valor aqui é **Produtividade e Assertividade**. Ele não quer ler 50 páginas de PDF para tomar uma decisão. Ele quer uma tela limpa que diga: *"Recomendação: ACORDO de R$ 2.500,00. Motivo: 85% de chance de procedência para o autor (risco alto), autor é idoso (fator agravante regional). Resumo dos autos: [Texto curto]"*.
* **Persona 2: Banco UFMG (Cliente/Negócio):** O valor é **Redução de Custos (Saving) e Governança**. A IA garante que o banco não pague indenizações desnecessárias e não gaste com defesas em casos perdidos, padronizando a política de acordos em milhares de processos.

---

### 2. Estrutura Analítica do Projeto (EAP) - *Hackathon Edition*

A EAP divide o projeto em pacotes de trabalho focados na entrega da madrugada.

1.  **Gestão e Pitch (Transversal)**
    * 1.1. Definição da Política de Acordos (A regra de negócio em si).
    * 1.2. Criação da Apresentação (15 min).
    * 1.3. Gravação do Vídeo de Demonstração (2 min).
2.  **Engenharia de Dados e Machine Learning (Preditivo)**
    * 2.1. Limpeza e preparação da base de 60.000 sentenças (Focar em features chave: Valor da Causa, Tipo de Decisão, UF).
    * 2.2. Treinamento do Modelo de Classificação/Regressão (Ex: Random Forest ou XGBoost) para prever a probabilidade de Êxito/Não Êxito.
    * 2.3. Criação da API/Endpoint do modelo para o LLM consumir.
3.  **Desenvolvimento do Sistema Multi-Agentes (IA Generativa)**
    * 3.1. Setup do LLM Mestre (Orquestrador).
    * 3.2. Desenvolvimento do Agente Extrator (Coleta de dados principais + Briefing/Nuances). *Dica: Unir esses dois poupa tempo de latência.*
    * 3.3. Desenvolvimento do Agente de Policy (Aplica a regra de negócio + Output do ML).
    * 3.4. Desenvolvimento do Agente de Negociação (Cálculo da sugestão de valor com base em UF/Nuances).
    * 3.5. Desenvolvimento do Agente Revisor (Validação de formato e alucinação).
4.  **Plataforma / Interface do Usuário**
    * 4.1. Desenvolvimento da Tela do Admin (Upload de documentos simulado).
    * 4.2. Desenvolvimento da Dashboard do Advogado (Exibição dos resultados, justificativas e botão de "Aceitar Recomendação").
    * 4.3. Integração Frontend <> Backend (Agentes).

---

### 3. Definição de Requisitos (MVP)

**Requisitos Funcionais (O que o sistema TEM que fazer hoje):**
* **RF01:** O sistema deve permitir a entrada de dados do processo (texto dos autos/subsídios).
* **RF02:** O sistema deve extrair informações estruturadas (UF, Valor da Causa, Perfil do Autor) a partir de textos não estruturados.
* **RF03:** O sistema deve calcular e exibir a probabilidade de perda (Procedência/Parcial) usando a base de dados fornecida.
* **RF04:** O sistema deve emitir uma recomendação binária e justificada: **DEFESA** ou **ACORDO**.
* **RF05:** Se a recomendação for ACORDO, o sistema deve sugerir um valor financeiro teto para a negociação.
* **RF06:** O sistema deve apresentar os dados de forma amigável para o advogado aprovar ou rejeitar a diretriz.

**Requisitos Não Funcionais (Como ele deve fazer):**
* **RNF01 (Desempenho):** A análise do caso pelo fluxo de agentes deve ocorrer em um tempo aceitável para demonstração (ideal < 30 segundos).
* **RNF02 (Confiabilidade):** O Agente Revisor deve garantir que o valor do acordo sugerido nunca ultrapasse uma porcentagem lógica do Valor da Causa (evitar alucinações perigosas do LLM).

---

### 4. Backlog do Produto (Priorizado para Execução)

Para gerenciar as próximas horas da equipe, usem a técnica MoSCoW (Must, Should, Could, Won't).

**🔴 MUST HAVE (Foco total nas próximas 6 horas):**
1.  **Script de ML:** Treinar um modelo rápido com o CSV de 60k linhas. Se faltar tempo, usem uma regressão logística simples ou árvore de decisão. O importante é gerar um score (ex: 70% de chance de perda).
2.  **Prompt Engineering dos Agentes Principais:** Criar os prompts da OpenAI para o Agente Extrator e Agente Policy.
3.  **Interface Básica (Streamlit):** Construir uma tela em Python/Streamlit. É a forma mais rápida de ter um frontend funcional e bonito na madrugada.
4.  **Pipeline Funcional:** Conectar Texto -> Agentes -> Tela.

**🟡 SHOULD HAVE (Se o pipeline básico rodar):**
5.  **Agente de Nuances:** Adicionar a leitura de sentimentos/contexto (ex: "Autor é idoso").
6.  **Agente Revisor:** Implementar a dupla checagem via LLM para garantir qualidade impecável na saída de dados.

**🟢 COULD HAVE (Se sobrar tempo antes das 04:00):**
7.  **Dashboard do Banco:** Uma tela extra simulando o "Monitoramento de Efetividade e Aderência" (quantos advogados seguiram a IA vs. quantos ignoraram). Isso ganha muitos pontos com os jurados, mas pode ser apenas um protótipo de tela desenhado no Figma.

---

### 5. Arquitetura de Software

Aqui está o desenho arquitetural para vocês explicarem no Pitch de amanhã. É uma arquitetura híbrida (IA Determinística + IA Generativa).



**Componentes Tecnológicos Recomendados:**
* **Frontend (Advogado/Admin):** **Streamlit** (Python). Perfeito para hackathons, permite criar dashboards interativos com poucas linhas de código.
* **Orquestração de Agentes:** **LangChain** ou **CrewAI**. O CrewAI é fantástico para definir "Roles" (Policy, Revisor, etc.) de forma rápida. Se a equipe não dominar nenhum dos dois, façam a orquestração "na mão" chamando a API da OpenAI em sequência estruturada no Python (é mais rústico, mas funciona sob pressão).
* **Modelo de Linguagem:** **OpenAI GPT-4o** ou **GPT-3.5-Turbo** (usem o modelo mais rápido e barato para o Agente Extrator, e o mais inteligente para o Agente Policy/Mestre).
* **Machine Learning (Modelo Preditivo):** `Scikit-learn` ou `XGBoost`. Exportem o modelo em um arquivo `.pkl` e carreguem na aplicação principal.
* **Backend (se não for Streamlit monolítico):** FastAPI (Python).

**O Fluxo de Dados (Data Flow):**
1.  **Input:** O PDF/Texto entra no sistema.
2.  **Step 1 (Extração):** O Agente Extrator lê o texto e devolve um JSON estruturado: `{UF: "SP", Valor_Causa: 15000, Idoso: true}`.
3.  **Step 2 (Predição):** O backend pega as features estruturadas do passo anterior e joga no Modelo ML (treinado nos 60k). O Modelo devolve: `Chance de Acordo (Perda): 82%`.
4.  **Step 3 (Decisão & Valores):** O Agente de Policy recebe o JSON e a % de risco do ML. Ele aplica a regra do banco. O Agente de Acordo gera o valor.
5.  **Step 4 (Revisão):** Agente Revisor checa se o valor faz sentido.
6.  **Output:** Tela do advogado é populada.

**Dica de Ouro para a Apresentação:** Durante o pitch, destaquem que a solução de vocês não usa *apenas* IA Generativa (que pode ser instável), mas utiliza o LLM para **orquestrar** modelos matemáticos determinísticos (Machine Learning nos 60k casos) junto com regras de negócio. Isso mostra maturidade técnica e segurança jurídica, algo que os avaliadores de bancos e escritórios valorizam muito.
