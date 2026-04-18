import os
import glob
import json
from dotenv import load_dotenv
from openai import OpenAI
from pypdf import PdfReader

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def ler_pdf(caminho_pdf: str) -> str:
    reader = PdfReader(caminho_pdf)
    partes = []

    for pagina in reader.pages:
        texto = pagina.extract_text()
        if texto:
            partes.append(texto)

    return "\n".join(partes)

def escape_latex(texto: str) -> str:
    if not texto:
        return ""

    substituicoes = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }

    for velho, novo in substituicoes.items():
        texto = texto.replace(velho, novo)

    return texto

def ler_multiplos_pdfs(caminhos: list[str]) -> str:
    textos = []

    for caminho in caminhos:
        nome = os.path.basename(caminho)
        conteudo = ler_pdf(caminho)
        textos.append(f"\n\n### DOCUMENTO: {nome}\n{conteudo}")

    return "\n".join(textos)


def ler_pdfs_da_pasta(pasta: str) -> str:
    caminhos = sorted(glob.glob(os.path.join(pasta, "*.pdf")))

    if not caminhos:
        raise FileNotFoundError(f"Nenhum PDF encontrado na pasta: {pasta}")

    return ler_multiplos_pdfs(caminhos)


def extrair_estrutura_caso(texto_documentos: str) -> dict:
    prompt = f"""
Você é um agente jurídico especialista em organizar documentação de processos cíveis de transação não reconhecida.

Sua tarefa é analisar os documentos abaixo e retornar APENAS um JSON válido com a seguinte estrutura:

{{
  "identificacao": {{
    "numero_processo": "",
    "uf": "",
    "comarca": "",
    "valor_causa": null
  }},

  "fatores_relevantes": {{
    "autor_idoso": "sim/não/incerto",
    "autor_aposentado": "sim/não/incerto",
    "pedido_tutela_urgencia": "sim/não",
    "pedido_dano_moral": "sim/não",
    "valor_dano_moral": null,
    "pedido_repeticao_indebito": "sim/não",
    "alegacao_vulnerabilidade": "sim/não",
    "alegacao_uso_indevido_dados": "sim/não"
  }},

  "resumo_caso": "",
  "alegacoes_autor": [],
  "documentos_banco": [],
  "pontos_favoraveis_banco": [],
  "pontos_desfavoraveis_banco": [],
  "observacoes_importantes": ""
}}

Regras:
- Não invente informação.
- Se algo não estiver claro, use null, lista vazia ou "incerto".
- Retorne apenas JSON válido.
- "resumo_caso" deve ser um parágrafo curto e objetivo.
- "alegacoes_autor" deve listar os principais argumentos do autor.
- "documentos_banco" deve listar os principais documentos/evidências do banco.
- "pontos_favoraveis_banco" e "pontos_desfavoraveis_banco" devem ser objetivos.
- "observacoes_importantes" deve destacar nuances sensíveis do caso.

Documentos:
{texto_documentos}
"""

    resposta = client.chat.completions.create(
        model="gpt-5",
        messages=[
            {"role": "system", "content": "Você organiza documentos jurídicos em JSON estruturado."},
            {"role": "user", "content": prompt}
        ],
        temperature=0
    )

    conteudo = resposta.choices[0].message.content.strip()
    return json.loads(conteudo)