import json
import math
import os
import re
import sys
from typing import Any

import joblib
import numpy as np
import pandas as pd

try:
    import shap  # type: ignore
except Exception:
    shap = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUB_MICRO_DIR = os.path.join(BASE_DIR, "sub_micro")
MODEL_PATH = os.path.join(SUB_MICRO_DIR, "modelo_resultado_micro.pkl")
LABEL_ENCODER_PATH = os.path.join(SUB_MICRO_DIR, "label_encoder_resultado_micro.pkl")
ENCODERS_PATH = os.path.join(SUB_MICRO_DIR, "encoders_colunas_micro.pkl")
FEATURES_PATH = os.path.join(SUB_MICRO_DIR, "features_micro.pkl")


def _norm_label(value: Any) -> str:
    txt = str(value or "").strip().lower()
    txt = (
        txt.replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("ã", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )
    return txt


def infer_sub_assunto(resumo_caso: str, alegacoes_autor: list[str], observacoes_importantes: str) -> str:
    texto = " ".join([
        resumo_caso or "",
        " ".join(alegacoes_autor or []),
        observacoes_importantes or "",
    ]).lower()

    keywords_golpe = [
        "fraude",
        "golpe",
        "terceiro",
        "uso indevido",
        "dados pessoais",
        "conta de terceiro",
    ]

    for keyword in keywords_golpe:
        if keyword in texto:
            return "Golpe"

    return "Genérico"


def build_input_df(payload: dict[str, Any], features: list[str]) -> pd.DataFrame:
    identificacao = payload.get("identificacao") or {}

    uf = str(identificacao.get("uf") or "AM")
    valor_causa = identificacao.get("valor_causa")
    try:
        valor_causa = float(valor_causa or 0)
    except Exception:
        valor_causa = 0.0

    resumo_caso = str(payload.get("resumo_caso") or "")
    alegacoes_autor = payload.get("alegacoes_autor") or []
    observacoes_importantes = str(payload.get("observacoes_importantes") or "")

    row = {
        "UF": uf,
        "Assunto": "Não reconhece operação",
        "Sub-assunto": infer_sub_assunto(resumo_caso, alegacoes_autor, observacoes_importantes),
        "Valor da causa": valor_causa,
    }

    for col in features:
        if col not in row:
            row[col] = 0

    return pd.DataFrame([row])[features]


def apply_encoders(df: pd.DataFrame, encoders_colunas: dict[str, Any]) -> pd.DataFrame:
    out = df.copy()

    for col, encoder in encoders_colunas.items():
        if col not in out.columns:
            continue

        value = str(out.loc[0, col])
        classes = list(getattr(encoder, "classes_", []))
        if classes and value not in classes:
            value = classes[0]

        out[col] = encoder.transform([value])

    return out


def classes_from_model(model: Any, label_encoder: Any, n_classes: int) -> list[str]:
    if label_encoder is not None and hasattr(label_encoder, "inverse_transform"):
        try:
            return [str(x) for x in label_encoder.inverse_transform(np.arange(n_classes))]
        except Exception:
            pass

    if hasattr(model, "classes_"):
        return [str(x) for x in model.classes_]

    return [str(i) for i in range(n_classes)]


def map_probabilities(raw_probs: np.ndarray, class_names: list[str]) -> dict[str, float]:
    mapped = {
        "improcedencia": 0.0,
        "parcial_procedencia": 0.0,
        "procedencia": 0.0,
    }

    for prob, name in zip(raw_probs, class_names):
        n = _norm_label(name)
        p = float(prob)

        if "improced" in n:
            mapped["improcedencia"] += p
        elif "parcial" in n:
            mapped["parcial_procedencia"] += p
        elif "proced" in n:
            mapped["procedencia"] += p

    total = sum(mapped.values())
    if total <= 0:
        max_idx = int(np.argmax(raw_probs)) if len(raw_probs) else 0
        fallback_name = _norm_label(class_names[max_idx]) if class_names else ""
        if "improced" in fallback_name:
            mapped["improcedencia"] = 1.0
        elif "parcial" in fallback_name:
            mapped["parcial_procedencia"] = 1.0
        else:
            mapped["procedencia"] = 1.0
        total = 1.0

    for key in mapped:
        mapped[key] = mapped[key] / total

    return mapped


def compute_shap(model: Any, X: pd.DataFrame, class_index: int) -> tuple[list[dict[str, float]], str]:
    if shap is None:
        raise RuntimeError("shap não disponível no ambiente Python")

    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(X)

    if isinstance(values, list):
        class_values = values[class_index]
        row_values = class_values[0]
    else:
        row_values = values[0]

    feature_names = list(X.columns)
    pairs = [
        {"feature": str(feature), "value": float(value)}
        for feature, value in zip(feature_names, row_values)
    ]

    pairs.sort(key=lambda item: abs(item["value"]), reverse=True)
    return pairs, "shap"


def fallback_feature_importance(model: Any, X: pd.DataFrame) -> tuple[list[dict[str, float]], str]:
    importances = getattr(model, "feature_importances_", None)
    if importances is None:
        return [], "none"

    values = np.array(importances, dtype=float)
    denom = float(values.sum())
    if denom > 0:
        values = values / denom

    pairs = [
        {"feature": str(feature), "value": float(value)}
        for feature, value in zip(X.columns, values)
    ]
    pairs.sort(key=lambda item: abs(item["value"]), reverse=True)
    return pairs, "feature_importance_fallback"


def main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")

    model = joblib.load(MODEL_PATH)
    label_encoder = None
    if os.path.exists(LABEL_ENCODER_PATH):
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
    encoders_colunas = joblib.load(ENCODERS_PATH)
    features = joblib.load(FEATURES_PATH)
    if not isinstance(features, list):
        features = list(features)

    X = build_input_df(payload, features)
    X_trans = apply_encoders(X, encoders_colunas)

    if hasattr(model, "predict_proba"):
        raw_probs = np.array(model.predict_proba(X_trans)[0], dtype=float)
    else:
        pred = model.predict(X_trans)[0]
        n = 3
        raw_probs = np.zeros(n, dtype=float)
        idx = int(pred) if str(pred).isdigit() else 0
        idx = max(0, min(n - 1, idx))
        raw_probs[idx] = 1.0

    n_classes = len(raw_probs)
    class_names = classes_from_model(model, label_encoder, n_classes)
    mapped = map_probabilities(raw_probs, class_names)

    p_nao_exito = float(mapped["parcial_procedencia"] + mapped["procedencia"])

    shap_pairs: list[dict[str, float]] = []
    shap_method = "none"
    try:
        class_index = int(np.argmax(raw_probs)) if len(raw_probs) else 0
        shap_pairs, shap_method = compute_shap(model, X_trans, class_index)
    except Exception:
        shap_pairs, shap_method = fallback_feature_importance(model, X_trans)

    out = {
        "probabilities": mapped,
        "p_nao_exito": p_nao_exito,
        "shap_values": shap_pairs,
        "model_metadata": {
            "classes": class_names,
            "shap_method": shap_method,
        },
    }

    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
