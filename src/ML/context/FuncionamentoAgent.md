# CONTEXTO — AI AGENT PARA ANÁLISE JURÍDICA (HACKATHON ENTER)

## Objetivo

Estamos desenvolvendo um AI Agent capaz de analisar processos judiciais de **transações não reconhecidas (fraude/golpe)** e recomendar automaticamente:

1. Se vale a pena fazer acordo ou seguir com defesa
2. Qual valor de acordo sugerido
3. Justificativa baseada nos documentos do caso e no histórico de decisões judiciais

O objetivo é padronizar decisões jurídicas e otimizar o custo esperado do contencioso para o banco.

---

# Dados disponíveis

Temos:

### 1. Documentos do caso (PDF)

Exemplos:

* Petição inicial
* Laudos
* Comprovantes de crédito BACEN
* Demonstrativo da dívida
* Outros subsídios

Esses documentos contêm informações jurídicas e probatórias relevantes para a decisão.

---

### 2. Base histórica (CSV)

Base com aproximadamente 60k processos contendo colunas como:

* Número do processo
* UF
* Assunto
* Sub-assunto (ex: golpe ou genérico)
* Resultado macro (Êxito ou Não Êxito)
* Resultado micro (Procedência, Improcedência, Parcial procedência, Extinção)
* Valor da causa
* Valor da condenação/indenização

Essa base será usada para treinar modelos preditivos.

---

# Ideia geral do AI Agent

O agent é basicamente um pipeline que:

1. lê os documentos do processo
2. extrai informações estruturadas usando LLM
3. usa o histórico do CSV para prever risco jurídico
4. decide acordo ou defesa
5. sugere valor de acordo se aplicável
6. gera saída estruturada para UI e PDF

---

# Arquitetura do Agent

## Agent 1 — Extractor

Responsável por ler os documentos e extrair informações relevantes.

Entrada:
PDFs do processo

Saída:
JSON estruturado com informações jurídicas.

Exemplo de campos extraídos:

* número do processo
* UF
* valor da causa
* autor idoso (sim/não/incerto)
* autor aposentado (sim/não/incerto)
* há alegação de fraude
* há alegação de transação não reconhecida
* há pedido de dano moral
* valor pedido de dano moral
* há divergência de conta bancária
* existe biometria
* existe vídeo de liveness
* existência de lacuna probatória
* observações importantes sobre o caso

Esses campos podem ser parcialmente incertos.

Campos mais subjetivos serão resumidos em:

observacoes_importantes

---

## Agent 2 — Risk Predictor

Usa o CSV histórico para prever:

probabilidade de êxito do banco

ou

probabilidade de não êxito

Também estima:

valor esperado de condenação

Exemplo de saída:

probabilidade de êxito: 0.32
probabilidade de não êxito: 0.68
valor esperado de condenação: 8400

---

## Agent 3 — Policy Agent

Decide a estratégia jurídica com base em:

probabilidade de perda
valor esperado de condenação
fragilidade da prova
fatores de vulnerabilidade do autor

Saída:

recomendação: acordo ou defesa

exemplo:

recomendação: acordo
confiança: alta
motivo: alta probabilidade de não êxito e risco financeiro elevado

---

## Agent 4 — Agreement Agent

Se a recomendação for acordo, sugere valor.

O valor sugerido será baseado no custo esperado da condenação.

Exemplo:

valor esperado de condenação: 8400
valor sugerido de acordo: 5040

Faixa de negociação:

mínimo: 3780
máximo: 6300

---

# Estrutura final da saída do agent

O agent retorna um JSON estruturado:

```json
{
  "extraction": {},
  "prediction": {},
  "policy": {},
  "agreement": {},
  "observacoes_importantes": ""
}
```

Esse JSON será usado pelo frontend e pelo gerador de PDF.

---

# Tecnologias do Agent

Python

Bibliotecas principais:

* pandas
* scikit-learn
* openai API
* pypdf

O agent será implementado como um pipeline de funções Python, não usando n8n.

---

# Estrutura do projeto

agent/
main.py
extractor.py
predictor.py
policy.py
agreement.py

data/
historico.csv

cases/
pdfs do processo

---

# Fluxo de execução

documentos do caso
↓
extração com LLM
↓
dados estruturados
↓
modelo treinado no CSV
↓
probabilidade de êxito
↓
cálculo de risco esperado
↓
decisão acordo ou defesa
↓
sugestão de valor
↓
json final

---

# MVP do agent

O mínimo necessário para funcionar:

extrair informações dos documentos
prever risco usando o CSV
decidir acordo ou defesa
sugerir valor de acordo
retornar JSON estruturado

---

# Observação importante

Todos os casos do CSV são de transação não reconhecida, não apenas empréstimo.

Portanto o schema do extractor deve ser genérico o suficiente para cobrir:

fraude
golpe
uso indevido de dados
transação não reconhecida
vulnerabilidade do consumidor

