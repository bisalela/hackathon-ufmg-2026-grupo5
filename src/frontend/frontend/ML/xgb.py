import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# 1. LER O ARQUIVO
nome_arquivo = "processos.csv"
df = pd.read_csv(nome_arquivo, encoding="utf-8-sig")

# Padronizar nomes de colunas
df.columns = df.columns.str.strip()

# 2. FILTRAR LINHAS COM RESULTADO MICRO = EXTINÇÃO
coluna_alvo = "Resultado micro"

df = df[df[coluna_alvo].astype(str).str.strip().str.lower() != "extinção"].copy()

# 3. TRATAR OS DADOS
le = LabelEncoder()

# Transformar o alvo em números
df[coluna_alvo] = le.fit_transform(df[coluna_alvo].astype(str))

# Transformar outras colunas de texto em números
for col in df.columns:
    if col != coluna_alvo and df[col].dtype == "object":
        df[col] = LabelEncoder().fit_transform(df[col].astype(str))

# 4. DIVIDIR DADOS
X = df.drop(coluna_alvo, axis=1)
y = df[coluna_alvo]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 5. TREINAR MODELO
modelo = xgb.XGBClassifier(
    n_estimators=200,
    max_depth=8,
    learning_rate=0.05,
    tree_method="hist",
    device="cpu",
    random_state=42
)

modelo.fit(X_train, y_train)

# 6. GERAR INDICADORES
y_pred = modelo.predict(X_test)

print("\n=== INDICADORES DE PERFORMANCE ===")
print(f"ACURÁCIA GERAL: {accuracy_score(y_test, y_pred):.2%}")

print("\nRELATÓRIO POR CATEGORIA:")
print(classification_report(y_test, y_pred, target_names=le.classes_))

print("\nMATRIZ DE CONFUSÃO (Erros vs Acertos):")
print(confusion_matrix(y_test, y_pred))