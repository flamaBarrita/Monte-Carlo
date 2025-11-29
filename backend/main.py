from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

app = FastAPI()

# Permitir que React (localhost:5173) hable con Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Definimos qué esperamos recibir del frontend
class SimulationInput(BaseModel):
    precio_actual: float
    volatilidad: float  # En porcentaje anual (ej. 0.20 para 20%)
    dias: int
    num_simulaciones: int

@app.post("/api/simulate")
def run_simulation(data: SimulationInput):
    # 1. Configuración de parámetros
    dt = 1 / 252  # Paso de tiempo (un día de trading)
    S0 = data.precio_actual
    mu = 0.10  # Rendimiento esperado (asumimos 10% anual para el ejemplo)
    sigma = data.volatilidad
    
    # 2. Generación masiva de aleatoriedad (La "matriz" de caminos)
    # Creamos retornos aleatorios log-normales de una sola vez
    shocks = np.random.normal(
        (mu - 0.5 * sigma**2) * dt, # Deriva (drift)
        sigma * np.sqrt(dt),        # Choque aleatorio
        (data.num_simulaciones, data.dias) # Tamaño de la matriz
    )
    
    # 3. Construcción de caminos de precios
    # Sumamos los cambios acumulados y aplicamos exponencial
    caminos = np.zeros((data.num_simulaciones, data.dias + 1))
    caminos[:, 0] = S0
    caminos[:, 1:] = S0 * np.exp(np.cumsum(shocks, axis=1))
    
    # 4. Cálculo de Estadísticas Finales (último día)
    precios_finales = caminos[:, -1]
    promedio = np.mean(precios_finales)
    
    # Percentil 5 (El escenario pesimista para el VaR)
    peor_caso_95 = np.percentile(precios_finales, 5)
    
    # Value at Risk: Cuánto dinero perderíamos en el peor 5% de los casos
    var_95 = S0 - peor_caso_95
    
    # Nota: Para la gráfica, enviamos solo una muestra (ej. 50 líneas)
    # para no saturar el navegador, pero los stats usan las 1000+ simulaciones.
    return {
        "stats": {
            "promedio_final": round(promedio, 2),
            "var_95": round(var_95, 2),
            "peor_escenario": round(peor_caso_95, 2)
        },
        # Convertimos a lista para JSON. Enviamos las primeras 50 simulaciones para graficar.
        "trayectorias": caminos[:50].tolist(), 
        "dias": list(range(data.dias + 1))
    }