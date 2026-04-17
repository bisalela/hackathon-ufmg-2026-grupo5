import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# 1. Carregar os dados
df = pd.read_csv('Cópia de Hackaton_Enter_Base_Candidatos.xlsx - Subsídios disponibilizados.csv')

# 2. Seleção de variáveis
# X: Variáveis independentes (Subsídios)
# y: Variável dependente (Resultado macro)
X = df.drop(columns=['Número do processos', 'Resultado macro'])
y = df['Resultado macro']

# 3. Dividir os dados em treino e teste (80% treino, 20% teste)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. Criar e treinar o modelo de Regressão Logística
modelo = LogisticRegression()
modelo.fit(X_train, y_train)

# 5. Fazer previsões
y_pred = modelo.predict(X_test)

# 6. Avaliar o modelo
print("--- Acurácia do Modelo ---")
print(f"{accuracy_score(y_test, y_pred) * 100:.2f}%")
print("\n--- Relatório de Classificação ---")
print(classification_report(y_test, y_pred))

# Exemplo de Coeficientes (Importância de cada documento)
coeficientes = pd.DataFrame(modelo.coef_[0], X.columns, columns=['Coeficiente']).sort_values(by='Coeficiente', ascending=False)
print("\n--- Influência de cada variável no resultado ---")
print(coeficientes)