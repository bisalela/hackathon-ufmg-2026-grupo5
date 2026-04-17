import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from catboost import CatBoostClassifier

# 1. LER OS DADOS
df = pd.read_csv("../data/historico.csv")

# 2. DEFINIR A COLUNA ALVO
coluna_alvo = "Resultado micro"

# 3. REMOVER LINHAS SEM ALVO
df = df.dropna(subset=[coluna_alvo]).copy()

# 4. REMOVER COLUNAS MUITO INÚTEIS
# ajuste essa lista conforme sua base
colunas_para_remover = []

# Exemplo:
# colunas_para_remover = ["id", "numero_processo", "link", "observacao_livre"]

colunas_existentes = [c for c in colunas_para_remover if c in df.columns]
df = df.drop(columns=colunas_existentes)

# 5. SEPARAR X E y
X = df.drop(columns=[coluna_alvo])
y = df[coluna_alvo].astype(str)

# 6. IDENTIFICAR COLUNAS CATEGÓRICAS
cat_features = X.select_dtypes(include=["object", "category"]).columns.tolist()

# 7. PREENCHER VALORES FALTANTES
for col in X.columns:
    if col in cat_features:
        X[col] = X[col].fillna("MISSING").astype(str)
    else:
        X[col] = X[col].fillna(X[col].median())

# 8. DIVIDIR TREINO E TESTE
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 9. RECRIAR cat_features COM BASE NO X_train
cat_features_idx = [X_train.columns.get_loc(col) for col in cat_features]

# 10. TREINAR O MODELO
modelo = CatBoostClassifier(
    iterations=500,
    depth=6,
    learning_rate=0.05,
    loss_function="MultiClass",   # use "Logloss" se forem só 2 classes
    eval_metric="Accuracy",
    verbose=100,
    random_seed=42
)

modelo.fit(
    X_train, y_train,
    cat_features=cat_features_idx,
    eval_set=(X_test, y_test),
    use_best_model=True
)

# 11. PREVER
y_pred = modelo.predict(X_test)
y_pred = y_pred.flatten()

# 12. AVALIAR
acc = accuracy_score(y_test, y_pred)
print("Accuracy:", acc)
print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))
print("\nConfusion Matrix:\n")
print(confusion_matrix(y_test, y_pred))
