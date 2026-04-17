import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# 1. LER O ARQUIVO 
nome_arquivo = 'processos.csv' 
df = pd.read_csv(nome_arquivo)

# 2. TRATAR OS DADOS (Convertendo texto para números)
le = LabelEncoder()
coluna_alvo = 'Resultado micro' # Ajuste para o nome da sua coluna de saída

# Transformando o alvo (extincao, procedencia...) em números
df[coluna_alvo] = le.fit_transform(df[coluna_alvo].astype(str))

# Transformando as outras colunas de texto em números para a IA entender
for col in df.columns:
    if df[col].dtype == 'object':
        df[col] = LabelEncoder().fit_transform(df[col].astype(str))

# 3. DIVIDIR DADOS
X = df.drop(coluna_alvo, axis=1)
y = df[coluna_alvo]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. TREINAR MODELO
modelo = xgb.XGBClassifier(
    n_estimators=200,
    max_depth=8,
    learning_rate=0.05,
    tree_method='hist',
    device='cpu', 
    random_state=42
)

modelo.fit(X_train, y_train)

# 5. GERAR INDICADORES
y_pred = modelo.predict(X_test)

print("\n=== INDICADORES DE PERFORMANCE ===")
# Acurácia: Porcentagem geral de acerto
print(f"ACURÁCIA GERAL: {accuracy_score(y_test, y_pred):.2%}")

# Relatório detalhado: Precisão, Recall e F1-Score por categoria
print("\nRELATÓRIO POR CATEGORIA:")
print(classification_report(y_test, y_pred, target_names=le.classes_))

# Matriz de Confusão: Mostra onde a IA está "confusa"
print("\nMATRIZ DE CONFUSÃO (Erros vs Acertos):")
print(confusion_matrix(y_test, y_pred))