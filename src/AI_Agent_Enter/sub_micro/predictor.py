import joblib
import pandas as pd


MODELO_PATH = "sub_micro/modelo_resultado_micro.pkl"
LE_PATH = "sub_micro/label_encoder_resultado_micro.pkl"
ENCODERS_PATH = "sub_micro/encoders_colunas_micro.pkl"


def carregar_subagent_micro():
    modelo = joblib.load(MODELO_PATH)
    label_encoder = joblib.load(LE_PATH)
    encoders_colunas = joblib.load(ENCODERS_PATH)

    return modelo, label_encoder, encoders_colunas


def inferir_subassunto(dados_caso: dict) -> str:
    texto = " ".join([
        dados_caso.get("resumo_caso", ""),
        " ".join(dados_caso.get("alegacoes_autor", [])),
        " ".join(dados_caso.get("observacoes_importantes", "").split())
    ]).lower()

    palavras_golpe = [
        "fraude",
        "golpe",
        "terceiro",
        "uso indevido",
        "dados pessoais",
        "conta de terceiro"
    ]

    for palavra in palavras_golpe:
        if palavra in texto:
            return "Golpe"

    return "Genérico"


def montar_features_micro(dados_caso: dict) -> pd.DataFrame:
    identificacao = dados_caso.get("identificacao", {})

    uf = identificacao.get("uf", "AM")
    valor_causa = identificacao.get("valor_causa", 0.0)

    assunto = "Não reconhece operação"
    sub_assunto = inferir_subassunto(dados_caso)

    entrada = pd.DataFrame([{
        "UF": uf,
        "Assunto": assunto,
        "Sub-assunto": sub_assunto,
        "Valor da causa": valor_causa
    }])

    return entrada


def aplicar_encoders(entrada: pd.DataFrame, encoders_colunas: dict) -> pd.DataFrame:
    entrada = entrada.copy()

    for col, encoder in encoders_colunas.items():
        if col in entrada.columns:
            valor = str(entrada.loc[0, col])

            if valor not in encoder.classes_:
                # fallback simples: usa primeira classe conhecida
                valor = encoder.classes_[0]

            entrada[col] = encoder.transform([valor])

    return entrada


def prever_resultado_micro(dados_caso: dict) -> dict:
    modelo, label_encoder, encoders_colunas = carregar_subagent_micro()

    entrada = montar_features_micro(dados_caso)
    entrada_transformada = aplicar_encoders(entrada, encoders_colunas)

    pred_num = modelo.predict(entrada_transformada)[0]
    pred_texto = label_encoder.inverse_transform([pred_num])[0]

    probabilidades = None
    if hasattr(modelo, "predict_proba"):
        probs = modelo.predict_proba(entrada_transformada)[0]
        classes = label_encoder.inverse_transform(range(len(probs)))
        probabilidades = {
            classe: float(prob) for classe, prob in zip(classes, probs)
        }

    return {
        "classe_predita": pred_texto,
        "probabilidades": probabilidades,
        "features_utilizadas": entrada.to_dict(orient="records")[0]
    }