import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import axios from 'axios';

/**
 * Componente Principal: Simulador Monte Carlo
 */
function App() {
  
  // 1. CONFIGURACIÓN Y DATOS
  const [config, setConfig] = useState({ precio: 5000, vol: 0.2, dias: 15, sims: 50 });
  const [cargando, setCargando] = useState(false);
  const [resultadoGlobal, setResultadoGlobal] = useState(null);

  // 2. ESTADOS DE LA ANIMACIÓN
  const [historialCompleto, setHistorialCompleto] = useState([]); 
  const [historialVisible, setHistorialVisible] = useState([]);   
  const [diaActual, setDiaActual] = useState(0);                  
  
  // CORRECCIÓN AQUÍ: Nombre de variable arreglado
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(100); 

  // 3. INTERACCIÓN USUARIO
  const [datosBajoCursor, setDatosBajoCursor] = useState(null); 
  const timerRef = useRef(null); 

  // --- LÓGICA DEL NEGOCIO ---

  const ejecutarSimulacion = async () => {
    setCargando(true);
    resetearAnimacion();

    try {
      const res = await axios.post('http://localhost:8000/api/simulate', {
        precio_actual: config.precio,
        volatilidad: config.vol,
        dias: config.dias,
        num_simulaciones: config.sims
      });
      
      setResultadoGlobal(res.data.stats);

      const datosProcesados = res.data.dias.map((dia, index) => {
        let puntoGrafica = { dia: dia };
        let preciosDelDia = [];

        res.data.trayectorias.forEach((sim, simIndex) => {
          puntoGrafica[`sim_${simIndex}`] = sim[index];
          preciosDelDia.push(sim[index]);
        });

        puntoGrafica.maximo = Math.max(...preciosDelDia);
        puntoGrafica.minimo = Math.min(...preciosDelDia);
        puntoGrafica.promedio = preciosDelDia.reduce((a, b) => a + b, 0) / preciosDelDia.length;
        
        return puntoGrafica;
      });

      setHistorialCompleto(datosProcesados);
      setHistorialVisible(datosProcesados.slice(0, 1)); 
      setReproduciendo(true); 

    } catch (error) {
      console.error(error);
      alert("No se pudo conectar con el servidor Python.");
    }
    setCargando(false);
  };

  // Motor de Animación
  useEffect(() => {
    if (reproduciendo && historialCompleto.length > 0) {
      timerRef.current = setInterval(() => {
        setDiaActual((prev) => {
          if (prev >= historialCompleto.length - 1) {
            setReproduciendo(false);
            return prev;
          }
          return prev + 1; 
        });
      }, velocidad);
    } else {
      clearInterval(timerRef.current); 
    }
    return () => clearInterval(timerRef.current); 
  }, [reproduciendo, historialCompleto, velocidad]);

  // Sincronizar Gráfica
  useEffect(() => {
    if (historialCompleto.length > 0) {
      setHistorialVisible(historialCompleto.slice(0, diaActual + 1));
    }
  }, [diaActual, historialCompleto]);

  // Controles
  const togglePausa = () => setReproduciendo(!reproduciendo);
  
  const resetearAnimacion = () => {
    setReproduciendo(false);
    setDiaActual(0);
    setHistorialVisible(historialCompleto.slice(0, 1));
    setDatosBajoCursor(null);
  };

  const cambiarDiaManual = (e) => {
    setDiaActual(parseInt(e.target.value));
  };

  // Panel Lateral Lógica
  const datosPanel = datosBajoCursor || (historialVisible.length > 0 ? historialVisible[historialVisible.length - 1] : null);

  return (
    <div style={{ padding: '40px 20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#333' }}>
      <h1 style={{textAlign: 'center', marginBottom: '30px'}}>🔮 Predicción Monte Carlo</h1>
      
      {/* 1. BARRA DE CONFIGURACIÓN */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap', justifyContent: 'center', padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
        <InputGroup label="Precio Inicial" val={config.precio} onChange={v => setConfig({...config, precio: v})} />
        <InputGroup label="Volatilidad (0.2 = 20%)" val={config.vol} step="0.01" onChange={v => setConfig({...config, vol: v})} />
        <InputGroup label="Días a proyectar" val={config.dias} onChange={v => setConfig({...config, dias: v})} />
        
        <button 
          onClick={ejecutarSimulacion} 
          disabled={cargando} 
          style={{
            padding: '10px 25px', 
            background: cargando ? '#ccc' : '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: cargando ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            alignSelf: 'flex-end'
          }}>
          {cargando ? 'Calculando...' : '▶ Iniciar Simulación'}
        </button>
      </div>

      {historialCompleto.length > 0 && (
        <>
          {/* 2. TARJETA DE RIESGO */}
          <div style={{ borderLeft: '6px solid #e74c3c', padding: '20px', borderRadius: '8px', marginBottom: '30px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <div>
              <h2 style={{margin: 0, fontSize: '20px'}}>Riesgo Máximo Estimado (VaR 95%)</h2>
              <p style={{margin: '5px 0 0 0', color: '#666', fontSize: '14px'}}>Si todo sale mal, esto es lo máximo que deberías perder.</p>
            </div>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#e74c3c', margin: 0 }}>
              -${resultadoGlobal.var_95} 
            </p>
          </div>

          {/* 3. ZONA VISUAL */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
            
            {/* IZQUIERDA: GRÁFICA */}
            <div style={{ flex: 3, background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{margin:0}}>Evolución de Escenarios</h3>
                <div>
                  <small style={{marginRight: '10px', color: '#666'}}>Velocidad:</small>
                  <button onClick={() => setVelocidad(200)} style={btnStyle}>Lento</button>
                  <button onClick={() => setVelocidad(100)} style={btnStyle}>Normal</button>
                  <button onClick={() => setVelocidad(5)} style={btnStyle}>Rápido</button>
                </div>
              </div>

              <div style={{ height: '500px', width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart 
                    data={historialVisible} 
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                    onMouseMove={(e) => { if (e.activePayload) setDatosBajoCursor(e.activePayload[0].payload); }}
                    onMouseLeave={() => setDatosBajoCursor(null)}
                  >
                    <XAxis dataKey="dia" type="number" domain={[0, config.dias]} />
                    <YAxis domain={['auto', 'auto']} width={40} />
                    <ReferenceLine y={config.precio} stroke="#27ae60" strokeDasharray="3 3" />

                    {Object.keys(historialVisible[0] || {}).filter(k => k.startsWith('sim_')).map((key) => (
                      <Line 
                        key={key} 
                        type="monotone" 
                        dataKey={key} 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        dot={false} 
                        strokeOpacity={0.15} 
                        isAnimationActive={false} 
                      />
                    ))}
                    <Line type="monotone" dataKey="promedio" stroke="#e67e22" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Controles de Reproducción */}
              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px', background: '#f1f2f6', padding: '10px', borderRadius: '8px' }}>
                <button onClick={togglePausa} style={{cursor:'pointer', padding: '8px 20px', border: 'none', background: reproduciendo ? '#f39c12' : '#2ecc71', color: 'white', borderRadius: '4px', fontWeight: 'bold'}}>
                  {reproduciendo ? '❚❚ Pausa' : '▶ Play'}
                </button>
                <input type="range" min="0" max={config.dias} value={diaActual} onChange={cambiarDiaManual} style={{ flexGrow: 1, cursor: 'pointer' }} />
              </div>
            </div>

            {/* DERECHA: PANEL DE INFORMACIÓN */}
            <div style={{ flex: 1, background: '#2c3e50', color: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
              
              {datosPanel ? (
                <>
                  <h4 style={{ margin: '0 0 10px 0', color: '#bdc3c7', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>
                    {datosBajoCursor ? "EXPLORANDO HISTORIAL" : "EN TIEMPO REAL"}
                  </h4>
                  <h2 style={{ margin: '0 0 30px 0', fontSize: '36px' }}>Día {datosPanel.dia}</h2>
                  
                  <div style={{ marginBottom: '25px' }}>
                    <small style={{ color: '#95a5a6', display: 'block', marginBottom: '5px' }}>Precio Promedio Esperado</small>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f1c40f' }}>
                      ${datosPanel.promedio?.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                      <small style={{ color: '#2ecc71', fontWeight: 'bold' }}>▲ Mejor Escenario</small>
                      <div style={{ fontSize: '20px' }}>${datosPanel.maximo?.toFixed(2)}</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                      <small style={{ color: '#e74c3c', fontWeight: 'bold' }}>▼ Peor Escenario</small>
                      <div style={{ fontSize: '20px' }}>${datosPanel.minimo?.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div style={{marginTop: 'auto', fontSize: '12px', color: '#7f8c8d', fontStyle: 'italic'}}>
                    Mueve el mouse sobre la gráfica para ver detalles específicos.
                  </div>
                </>
              ) : (
                <p>Esperando datos...</p>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}

// Componente auxiliar
const InputGroup = ({ label, val, onChange, step = "1" }) => (
  <div style={{display:'flex', flexDirection:'column'}}>
    <small style={{fontWeight: 'bold', marginBottom: '5px', color: '#555'}}>{label}</small>
    <input 
      type="number" 
      step={step} 
      value={val} 
      onChange={e => onChange(+e.target.value)} 
      style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '120px'}} 
    />
  </div>
);

const btnStyle = { marginRight:'5px', cursor:'pointer', padding: '2px 8px', fontSize: '12px' };

export default App;