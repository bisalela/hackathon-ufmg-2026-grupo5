Projeto: Plataforma de Triagem e Inteligência Jurídica
Caso de Uso Base: Contencioso de Massa (Banco UFMG)
1. Visão Geral e Proposta de Valor

O sistema é uma plataforma desenvolvida para automatizar e otimizar a triagem de processos judiciais de contencioso de massa. A ferramenta substitui a leitura humana inicial por uma rede de agentes de Inteligência Artificial, que confronta as alegações do autor (Ataque) com as provas da instituição (Defesa), sugerindo a melhor estratégia jurídica (ex: Propor Acordo vs. Contestar).

O grande diferencial ("o babado") da plataforma é o cálculo automático de ROI (Economia Gerada), provando em tempo real o valor financeiro salvo pela ferramenta através da diferença entre o risco inicial do processo e a condenação/acordo final.
2. Atores e Responsabilidades (Personas)

A plataforma possui separação rígida de papéis e permissões (RLS):

    Administrador (Operacional): Responsável por alimentar a máquina. Ele cadastra o processo, designa o advogado responsável e faz o upload dos documentos, classificando-os rigorosamente entre Autos (documentação da justiça/autor) e Subsídios (documentação de defesa do banco, como dossiês e laudos).

    Advogado (Estrategista): Não edita dados brutos nem sobe arquivos. Ele recebe o processo mastigado pela IA, revisa o confronto probatório gerado, adiciona comentários e toma a decisão final de negócio: Aprovar ou Reprovar a estratégia sugerida pela máquina.

3. Máquina de Estados (O Workflow do Processo)

O ciclo de vida do processo é linear e inquebrável, garantindo a integridade dos dados:

    nascimento: O Admin cria a pasta, separa ataque/defesa, insere os valores de risco e designa o advogado.

    triagem_ia: O Agent de IA entra em ação em background, cruza os dados dos documentos, gera a estratégia e estrutura o payload (JSON).

    analise_advogado: O processo aparece na fila do advogado no frontend. Ele lê o resumo da IA, insere seus comentários e escolhe se a sugestão foi boa ou ruim.

    aguardando_sentenca: A estratégia foi definida e aplicada no mundo real. O sistema aguarda a decisão do juiz.

    julgado: O processo é encerrado. O valor real definido pelo juiz (ou acordo) é inserido, e o sistema calcula automaticamente a economia gerada.

4. Arquitetura do Banco de Dados (Supabase)

O banco de dados relacional foi modelado para ser enxuto e altamente escalável, composto por 5 tabelas principais:

    perfis: Estende a autenticação segura do Supabase (auth.users), armazenando nome e tipo_usuario (adm ou advogado). Senhas não são armazenadas em texto plano.

    clientes: Armazena os clientes do sistema (ex: Banco UFMG e o segundo caso base).

    processos: O coração do sistema. Guarda IDs de relacionamento, status do workflow, decisão do advogado (comentários e aprovação) e os indicadores financeiros (Valor da Causa, Valor da Decisão e a coluna calculada economia_gerada).

    documentos: Gerencia o índice de arquivos que estão no Supabase Storage (bucket público documentos_processuais). Possui a trava frente para separar estritamente ataque_autos e defesa_subsidios.

    analises_agentes: Armazena o resultado da rede de Inteligência Artificial. Utiliza uma coluna JSONB flexível para guardar probabilidades, resumos e sugestões sem quebrar o esquema relacional, já preparado para injeção direta em templates LaTeX.

5. O Cérebro: Rede de Sub-Agentes (IA)

A inteligência do sistema não depende de um único prompt, mas de um workflow de agentes trabalhando em conjunto (Machine Learning preditivo, Análise de Policy, Agent de Acordo, Agent de Nuances).

O LLM Mestre consolida as respostas dessa rede e as injeta no banco de dados em um formato estruturado (JSON). Esse formato alimenta visualmente o frontend para o advogado e, estruturalmente, o gerador de relatórios em formato .tex (LaTeX) para exportação de pareceres técnicos e formais.
6. Stack Tecnológico e Infraestrutura

    Database & Auth: Supabase (PostgreSQL, Row Level Security, Supabase Storage).

    Backend/Integração: Edge Functions ou servidor Node/Python para orquestrar as chamadas da LLM.

    Inteligência: Modelos de linguagem (LLM) para extração de dados estruturados a partir de PDFs processuais.

    Frontend: Interface segmentada por perfis (Dashboard de Adm com métricas financeiras vs. Fila de Trabalho do Advogado).