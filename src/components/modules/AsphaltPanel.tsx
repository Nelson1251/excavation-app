// Módulo de Asfalto: elementos con largo × ancho × espesor, cantidad, desperdicio y notas.
// Calcula área, volumen neto, volumen a pedir (con desperdicio) y tonelaje con la densidad compactada.
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n/useT';
import type { Traductor } from '../../i18n';
import { formatearArea, formatearNumero, formatearVolumen, lbFt3ATM3, tM3ALbFt3, toneladasACortas } from '../../lib/units';
import type { SistemaUnidades } from '../../lib/units';
import {
  DESPERDICIO_ASFALTO_POR_DEFECTO,
  TIPOS_ASFALTO,
  calculoAsfalto,
  dimensionesAsfaltoPorDefecto,
  totalesAsfalto,
  type AsphaltElement,
  type TipoAsfalto,
} from '../../lib/asphalt';
import DistanceInput from '../DistanceInput';
import {
  CampoCantidad,
  CampoDesperdicio,
  CampoNumero,
  CampoSelect,
  CampoTexto,
  PanelModulo,
  Resultados,
  TarjetaElemento,
} from './ElementFields';

/** Tonelaje: toneladas métricas (Metros) o toneladas cortas de EE. UU. (Pies). */
const formatearToneladas = (t: number, sistema: SistemaUnidades, tr: Traductor) =>
  sistema === 'imperial'
    ? `${formatearNumero(toneladasACortas(t), 1)} ${tr('unit.shortTons')}`
    : `${formatearNumero(t, 1)} ${tr('unit.tonnes')}`;

function Elemento({ e }: { e: AsphaltElement }) {
  const t = useT();
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const densidad = useProjectStore((s) => s.densidadAsfalto);
  const update = useProjectStore((s) => s.updateAsphaltElement);
  const remove = useProjectStore((s) => s.removeAsphaltElement);
  const cambiar = (c: Partial<Omit<AsphaltElement, 'id'>>) => update(e.id, c);
  const c = calculoAsfalto(e, densidad);
  const dim = (campo: 'largo' | 'ancho' | 'espesor', etiqueta: 'dim.length' | 'dim.width' | 'dim.thickness') => (
    <DistanceInput
      id={`a-${campo}-${e.id}`}
      etiqueta={t(etiqueta)}
      valorM={e[campo]}
      onChange={(m) => {
        if (m !== null) cambiar({ [campo]: m });
      }}
    />
  );

  return (
    <TarjetaElemento onEliminar={() => remove(e.id)}>
      <div className="grid grid-cols-1 gap-3 pr-6 sm:grid-cols-4">
        <CampoSelect
          id={`a-tipo-${e.id}`}
          etiqueta={t('el.type')}
          valor={e.tipo}
          opciones={TIPOS_ASFALTO.map((tp) => ({ valor: tp, texto: t(`asphaltType.${tp}`) }))}
          onChange={(tipo) => cambiar({ tipo })}
        />
        <div className="sm:col-span-2">
          <CampoTexto id={`a-nombre-${e.id}`} etiqueta={t('el.name')} valor={e.nombre} onChange={(nombre) => cambiar({ nombre })} />
        </div>
        <CampoCantidad id={`a-cant-${e.id}`} valor={e.cantidad} onChange={(cantidad) => cambiar({ cantidad })} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        {dim('largo', 'dim.length')}
        {dim('ancho', 'dim.width')}
        {dim('espesor', 'dim.thickness')}
        <CampoDesperdicio id={`a-desp-${e.id}`} valor={e.desperdicio} onChange={(desperdicio) => cambiar({ desperdicio })} />
      </div>
      <div className="mt-3">
        <CampoTexto
          id={`a-notas-${e.id}`}
          etiqueta={t('el.notes')}
          valor={e.notas}
          onChange={(notas) => cambiar({ notas })}
          multilinea
          placeholder={t('asphalt.notesPlaceholder')}
        />
      </div>
      <Resultados
        filas={[
          { etiqueta: t('el.area'), valor: formatearArea(c.area, sistema) },
          { etiqueta: t('el.netVolume'), valor: formatearVolumen(c.neto, sistema) },
          { etiqueta: t('el.orderVolume'), valor: formatearVolumen(c.pedido, sistema), destacado: true },
          { etiqueta: t('el.tons'), valor: formatearToneladas(c.toneladas, sistema, t), destacado: true },
        ]}
      />
    </TarjetaElemento>
  );
}

/** Densidad compactada editable: t/m³ en Metros, lb/ft³ en Pies (se guarda en t/m³). */
function CampoDensidad() {
  const t = useT();
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const densidad = useProjectStore((s) => s.densidadAsfalto);
  const setDensidad = useProjectStore((s) => s.setDensidadAsfalto);
  const imperial = sistema === 'imperial';
  return (
    <div className="max-w-xs">
      <CampoNumero
        // key: al cambiar de unidades se reinicia el texto con el valor convertido.
        key={sistema}
        id="densidad-asfalto"
        etiqueta={t(imperial ? 'asphalt.densityImperial' : 'asphalt.densityMetric')}
        valor={imperial ? tM3ALbFt3(densidad) : densidad}
        decimales={imperial ? 1 : 3}
        onChange={(n) => setDensidad(imperial ? lbFt3ATM3(n) : n)}
        validar={(n) => (Number.isFinite(n) && n > 0 ? null : 'el.err.density')}
        pista={t(imperial ? 'asphalt.densityHint.imperial' : 'asphalt.densityHint.metric')}
      />
    </div>
  );
}

export default function AsphaltPanel() {
  const t = useT();
  const elementos = useProjectStore((s) => s.asphaltElements);
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const densidad = useProjectStore((s) => s.densidadAsfalto);
  const agregar = useProjectStore((s) => s.addAsphaltElement);
  const tot = totalesAsfalto(elementos, densidad);

  const onAgregar = (tipo: TipoAsfalto) => {
    const n = elementos.filter((e) => e.tipo === tipo).length + 1;
    agregar({
      tipo,
      nombre: t('el.defaultName', { type: t(`asphaltType.${tipo}`), n }),
      cantidad: 1,
      ...dimensionesAsfaltoPorDefecto(tipo),
      desperdicio: DESPERDICIO_ASFALTO_POR_DEFECTO,
      notas: '',
    });
  };

  return (
    <PanelModulo
      titulo={t('asphalt.heading', { count: elementos.length })}
      tipos={TIPOS_ASFALTO.map((tp) => ({ valor: tp, texto: t(`asphaltType.${tp}`) }))}
      onAgregar={onAgregar}
      vacio={elementos.length === 0}
      hijos={elementos.map((e) => (
        <Elemento key={e.id} e={e} />
      ))}
      totales={
        <>
          <CampoDensidad />
          <Resultados
            filas={[
              { etiqueta: t('el.area'), valor: formatearArea(tot.area, sistema) },
              { etiqueta: t('el.netVolume'), valor: formatearVolumen(tot.neto, sistema) },
              { etiqueta: t('el.orderVolume'), valor: formatearVolumen(tot.pedido, sistema), destacado: true },
              { etiqueta: t('el.tons'), valor: formatearToneladas(tot.toneladas, sistema, t), destacado: true },
            ]}
          />
        </>
      }
      nota={t('asphalt.note')}
    />
  );
}
