import sys
import json
import os

from extractor import ler_pdfs_da_pasta, extrair_estrutura_caso
from report_builder import montar_campos_latex
from sub_micro.predictor import prever_resultado_micro


def main():
    if len(sys.argv) < 2:
        print("Uso: python3 main.py <caminho_da_pasta_do_caso>")
        return

    pasta_caso = sys.argv[1]

    if not os.path.isdir(pasta_caso):
        print(f"Erro: a pasta '{pasta_caso}' não existe.")
        return

    texto_documentos = ler_pdfs_da_pasta(pasta_caso)

    dados_caso = extrair_estrutura_caso(texto_documentos)
    campos_latex = montar_campos_latex(dados_caso)

    resultado_micro = prever_resultado_micro(dados_caso)

    bloco_subagent_micro = f"""
\\section*{{Análise preditiva}}

\\textbf{{Resultado micro previsto:}} {resultado_micro["classe_predita"]} \\\\
\\textbf{{UF:}} {resultado_micro["features_utilizadas"]["UF"]} \\\\
\\textbf{{Assunto:}} {resultado_micro["features_utilizadas"]["Assunto"]} \\\\
\\textbf{{Sub-assunto:}} {resultado_micro["features_utilizadas"]["Sub-assunto"]} \\\\
\\textbf{{Valor da causa:}} R\\$ {resultado_micro["features_utilizadas"]["Valor da causa"]}
""".strip()

    if resultado_micro["probabilidades"]:
        bloco_subagent_micro += "\n\n\\subsection*{Probabilidades por classe}\n"
        for classe, prob in resultado_micro["probabilidades"].items():
            bloco_subagent_micro += f"\\textbf{{{classe}:}} {prob:.2%} \\\\\n"

    resultado_final = {
        "dados_caso": dados_caso,
        "resultado_micro": resultado_micro,
        "campos_latex": campos_latex
    }

    nome_pasta = os.path.basename(os.path.normpath(pasta_caso))
    nome_json = f"saida_{nome_pasta}.json"
    nome_tex = f"relatorio_base_{nome_pasta}.tex"

    with open(nome_json, "w", encoding="utf-8") as f:
        json.dump(resultado_final, f, ensure_ascii=False, indent=2)

    fatores = dados_caso["fatores_relevantes"]

    latex_completo = f"""
\\documentclass[12pt]{{article}}

\\usepackage[T1]{{fontenc}}
\\usepackage[utf8]{{inputenc}}
\\usepackage[brazil]{{babel}}
\\usepackage{{lmodern}}
\\usepackage{{geometry}}
\\usepackage{{enumitem}}

\\geometry{{margin=2.5cm}}

\\title{{Relatório de Análise Jurídica}}
\\author{{Sistema de IA}}
\\date{{}}

\\begin{{document}}

\\maketitle

\\section*{{Identificação do caso}}

\\textbf{{Número do processo:}} {campos_latex["numero_processo"]} \\\\
\\textbf{{UF:}} {campos_latex["uf"]} \\\\
\\textbf{{Comarca:}} {campos_latex["comarca"]} \\\\
\\textbf{{Valor da causa:}} R\\$ {campos_latex["valor_causa"]}

{campos_latex["bloco_resumo_fatos"]}

{campos_latex["bloco_alegacoes_autor"]}

{campos_latex["bloco_analise_documental"]}

{campos_latex["bloco_pontos_criticos"]}

\\section*{{Fatores jurídicos relevantes}}

Autor pessoa idosa: {fatores["autor_idoso"]} \\\\
Autor aposentado/pensionista: {fatores["autor_aposentado"]} \\\\
Pedido de tutela de urgência: {fatores["pedido_tutela_urgencia"]} \\\\
Pedido de dano moral: {fatores["pedido_dano_moral"]} \\\\
Valor do dano moral: R\\$ {fatores["valor_dano_moral"]} \\\\
Pedido de repetição de indébito: {fatores["pedido_repeticao_indebito"]} \\\\
Alegação de vulnerabilidade econômica: {fatores["alegacao_vulnerabilidade"]} \\\\
Uso indevido de dados: {fatores["alegacao_uso_indevido_dados"]}

{bloco_subagent_micro}

\\section*{{Recomendação estratégica}}

{campos_latex["placeholder_subagent_acordo"]}

\\end{{document}}
"""

    with open(nome_tex, "w", encoding="utf-8") as f:
        f.write(latex_completo)

    print(json.dumps(resultado_final, ensure_ascii=False, indent=2))
    print(f"\\nSaída JSON salva em: {nome_json}")
    print(f"Relatório base LaTeX salvo em: {nome_tex}")


if __name__ == "__main__":
    main()