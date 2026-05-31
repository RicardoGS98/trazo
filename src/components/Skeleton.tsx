import { IconBack } from './Icons'
import { t } from '../lib/i18n'

/** Esqueleto de carga mientras se consulta el envío. */
export function Skeleton({ onBack }: { onBack: () => void }) {
  return (
    <>
      <button className="back" onClick={onBack}>
        <IconBack /> {t('detail.back')}
      </button>
      <div className="sk">
        <div className="sk-line" style={{ width: '35%', height: 9 }}></div>
        <div className="sk-line" style={{ width: '65%', height: 20, marginTop: 14 }}></div>
        <div className="sk-line" style={{ width: '30%' }}></div>
        <div style={{ height: 14 }}></div>
        <div className="sk-line" style={{ width: '80%' }}></div>
        <div className="sk-line" style={{ width: '55%' }}></div>
        <div className="sk-line" style={{ width: '70%' }}></div>
      </div>
    </>
  )
}
