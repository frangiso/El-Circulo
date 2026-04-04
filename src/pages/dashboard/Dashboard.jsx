import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { estadoPlan, hoy, mesActual, fmtMonto } from '../../utils/helpers'

export default function Dashboard() {
  const navigate = useNavigate()
  const { getPacientes } = useCache()
  const [data, setData] = useState(null)

  useEffect(() => {
    async function cargar() {
      const hoyS = hoy()
      const mes  = mesActual()

      // 3 lecturas en paralelo — mínimo posible para el dashboard
      const [tsSnap, pacs, cajaSnap] = await Promise.all([
        // 1: turnos de hoy filtrado por fecha exacta
        getDocs(query(
          collection(db, 'turnos'),
          where('fecha', '==', hoyS),
          orderBy('hora')
        )),
        // 2: pacientes activos desde caché (0 lecturas si ya está)
        getPacientes(),
        // 3: caja del mes (1 solo documento)
        getDoc(doc(db, 'caja', 'caja_' + mes))
      ])

      const turnos = tsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      // Calcular alertas en memoria — sin lecturas extra
      const venc = pacs.filter(p => p.plan && estadoPlan(p.plan) === 'vencido')
      const porV = pacs.filter(p => p.plan && estadoPlan(p.plan) === 'por-vencer')

      // Calcular saldo de caja desde el doc del mes
      let saldo = 0
      if (cajaSnap.exists()) {
        const cajData = cajaSnap.data()
        saldo = cajData.saldoInicial || 0
        const movs = cajData.movimientos || []
        movs.forEach(m => { saldo += m.tipo === 'entrada' ? m.importe : -m.importe })
      }

      setData({ turnos, totalPacs: pacs.length, venc, porV, saldo })
    }
    cargar()
  }, [])

  if (!data) return <div className="sc"><div className="sp" /></div>

  const label = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 16, textTransform: 'capitalize' }}>
        {label}
      </div>

      <div className="mets m4">
        <div className="met">
          <div className="met-l">Turnos hoy</div>
          <div className="met-v caz">{data.turnos.length}</div>
        </div>
        <div className="met">
          <div className="met-l">Pacientes activos</div>
          <div className="met-v">{data.totalPacs}</div>
        </div>
        <div className="met">
          <div className="met-l">Planes vencidos</div>
          <div className="met-v" style={{ color: data.venc.length > 0 ? 'var(--ro)' : 'inherit' }}>
            {data.venc.length}
          </div>
        </div>
        <div className="met">
          <div className="met-l">Saldo en caja</div>
          <div className="met-v cve">{fmtMonto(data.saldo)}</div>
        </div>
      </div>

      {data.venc.length > 0 && (
        <div className="al alr">
          {data.venc.length} paciente{data.venc.length > 1 ? 's' : ''} con plan vencido: {data.venc.map(p => p.apellido + ' ' + p.nombre).join(', ')}
        </div>
      )}
      {data.porV.length > 0 && (
        <div className="al ala">
          {data.porV.length} paciente{data.porV.length > 1 ? 's' : ''} con plan por vencer en los próximos 10 días hábiles
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="card-title" style={{ margin: 0 }}>Turnos de hoy</div>
          <button className="btn bp bsm" onClick={() => navigate('/turnos/nuevo')}>+ Nuevo turno</button>
        </div>
        {data.turnos.length === 0 ? (
          <div className="emt">No hay turnos cargados para hoy</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Hora</th><th>Paciente</th><th>Obra social</th>
                  <th>Kinesiológo</th><th>Sesión</th>
                </tr>
              </thead>
              <tbody>
                {data.turnos.map(t => (
                  <tr key={t.id} onClick={() => navigate('/pacientes/' + t.pacienteId)}>
                    <td className="fw6">{t.hora}</td>
                    <td>{t.pacienteApellido} {t.pacienteNombre}</td>
                    <td>{t.obraSocial ? <span className="badge bb">{t.obraSocial}</span> : '—'}</td>
                    <td>{t.kinesiologoNombre}</td>
                    <td>{t.nroSesion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
