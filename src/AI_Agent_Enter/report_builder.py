def escapar_latex(texto: str) -> str:
    if texto is None:
        return ""

    texto = str(texto)

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


def lista_para_itemize(itens: list[str]) -> str:
    if not itens:
        return "\\item Nenhum ponto identificado."
    return "\n".join([f"\\item {escapar_latex(item)}" for item in itens])


def montar_campos_latex(dados: dict) -> dict:
    identificacao = dados.get("identificacao", {})
    resumo_caso = escapar_latex(dados.get("resumo_caso", ""))
    alegacoes_autor = dados.get("alegacoes_autor", [])
    documentos_banco = dados.get("documentos_banco", [])
    pontos_favoraveis = dados.get("pontos_favoraveis_banco", [])
    pontos_desfavoraveis = dados.get("pontos_desfavoraveis_banco", [])
    observacoes = escapar_latex(dados.get("observacoes_importantes", ""))

    bloco_resumo_fatos = f"""
\\section*{{Resumo dos fatos}}
{resumo_caso}
""".strip()

    bloco_alegacoes_autor = f"""
\\section*{{Alegações da parte autora}}
\\begin{{itemize}}
{lista_para_itemize(alegacoes_autor)}
\\end{{itemize}}
""".strip()

    bloco_analise_documental = f"""
\\section*{{Documentos e evidências apresentadas pelo banco}}
\\begin{{itemize}}
{lista_para_itemize(documentos_banco)}
\\end{{itemize}}
""".strip()

    bloco_pontos_criticos = f"""
\\section*{{Pontos críticos do caso}}
\\subsection*{{Pontos favoráveis ao banco}}
\\begin{{itemize}}
{lista_para_itemize(pontos_favoraveis)}
\\end{{itemize}}

\\subsection*{{Pontos desfavoráveis ao banco}}
\\begin{{itemize}}
{lista_para_itemize(pontos_desfavoraveis)}
\\end{{itemize}}

\\subsection*{{Observações importantes}}
{observacoes}
""".strip()

    placeholder_subagent_risco = r"""
% =========================
% TODO: SAÍDA DO SUBAGENT DE RISCO
% Inserir aqui:
% - probabilidade de êxito / não êxito
% - classificação preditiva
% - confiança do modelo
% =========================
""".strip()

    placeholder_subagent_acordo = r"""
% =========================
% TODO: SAÍDA DO SUBAGENT DE ACORDO
% Inserir aqui:
% - recomendação de acordo ou defesa
% - valor sugerido
% - faixa de negociação
% - justificativa econômica
% =========================
""".strip()

    return {
        "numero_processo": escapar_latex(identificacao.get("numero_processo")),
        "uf": escapar_latex(identificacao.get("uf")),
        "comarca": escapar_latex(identificacao.get("comarca")),
        "valor_causa": identificacao.get("valor_causa"),
        "bloco_resumo_fatos": bloco_resumo_fatos,
        "bloco_alegacoes_autor": bloco_alegacoes_autor,
        "bloco_analise_documental": bloco_analise_documental,
        "bloco_pontos_criticos": bloco_pontos_criticos,
        "placeholder_subagent_risco": placeholder_subagent_risco,
        "placeholder_subagent_acordo": placeholder_subagent_acordo
    }