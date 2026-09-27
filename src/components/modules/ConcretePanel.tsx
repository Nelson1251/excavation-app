// Módulo de Concreto: lista de elementos con dimensiones, cantidad, desperdicio y notas.
// Volumen neto = dimensiones × cantidad; volumen a pedir = neto × (1 + desperdicio).
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n/useT';
import type { Clave } from '../../i18n';
import { formatearVolumen } from '../../lib/units';
import {
  DESPERDICIO_CONCRETO_POR_DEFECTO,
  TIPOS_CONCRETO,
  dimensionesPorDefecto,
  esRedonda,
  totalesConcreto,
  volumenesConcreto,
  type ConcreteElement,
  type FormaColumna,
  type TipoConcreto,
} from '../../lib/concrete';
import DistanceInput from '../DistanceInput';
import {
  CampoCantidad,
  CampoDesperdicio,
  CampoSelect,
  CampoTexto,
  PanelModulo,
  Resultados,
  TarjetaElemento,
} from './ElementFields';

/** Etiquetas de las tres dimensiones (largo, ancho, alto) según el tipo de elemento. */
const ETIQUETAS_DIM: Record<TipoConcreto, [Clave, Clave, Clave]> = {
  banqueta: ['dim.length', 'dim.width', 'dim.thickness'],
  losa: ['dim.length', 'dim.width', 'dim.thickness'],
  zapata: ['dim.length', 'dim.width', 'dim.depth'],
  viga: ['dim.length', 'dim.width', 'dim.height'],
  muro: ['dim.length', 'dim.thickness', 'dim.height'],
  columna: ['dim.sideA', 'dim.sideB', 'dim.height'],
};

const FORMAS: readonly FormaColumna[] = ['rectangular', 'redonda'];

function Elemento({ e }: { e: ConcreteElement }) {
  const t = useT();
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const update = useProjectStore((s) => s.updateConcreteElement);
  const remove = useProjectStore((s) => s.removeConcreteElement);
  const cambiar = (c: Partial<Omit<ConcreteElement, 'id'>>) => update(e.id, c);
  const v = volumenesConcreto(e);
  const [d1, d2, d3] = ETIQUETAS_DIM[e.tipo];
  const dim = (campo: 'largo' | 'ancho' | 'alto' | 'diametro', etiqueta: Clave) => (
    <DistanceInput
      id={`c-${campo}-${e.id}`}
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
          id={`c-tipo-${e.id}`}
          etiqueta={t('el.type')}
          valor={e.tipo}
          opciones={TIPOS_CONCRETO.map((tp) => ({ valor: tp, texto: t(`concreteType.${tp}`) }))}
          onChange={(tipo) => cambiar({ tipo })}
        />
        <div className="sm:col-span-2">
          <CampoTexto id={`c-nombre-${e.id}`} etiqueta={t('el.name')} valor={e.nombre} onChange={(nombre) => cambiar({ nombre })} />
        </div>
        <CampoCantidad id={`c-cant-${e.id}`} valor={e.cantidad} onChange={(cantidad) => cambiar({ cantidad })} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        {e.tipo === 'columna' && (
          <CampoSelect
            id={`c-forma-${e.id}`}
            etiqueta={t('concrete.shape')}
            valor={e.forma}
            opciones={FORMAS.map((f) => ({ valor: f, texto: t(`shape.${f}`) }))}
            onChange={(forma) => cambiar({ forma })}
          />
        )}
        {esRedonda(e) ? (
          <>
            {dim('diametro', 'dim.diameter')}
            {dim('alto', 'dim.height')}
          </>
        ) : (
          <>
            {dim('largo', d1)}
            {dim('ancho', d2)}
            {dim('alto', d3)}
          </>
        )}
        <CampoDesperdicio id={`c-desp-${e.id}`} valor={e.desperdicio} onChange={(desperdicio) => cambiar({ desperdicio })} />
      </div>
      <div className="mt-3">
        <CampoTexto
          id={`c-notas-${e.id}`}
          etiqueta={t('el.notes')}
          valor={e.notas}
          onChange={(notas) => cambiar({ notas })}
          multilinea
          placeholder={t('concrete.notesPlaceholder')}
        />
      </div>
      <Resultados
        filas={[
          { etiqueta: t('el.netVolume'), valor: formatearVolumen(v.neto, sistema) },
          { etiqueta: t('el.orderVolume'), valor: formatearVolumen(v.pedido, sistema), destacado: true },
        ]}
      />
    </TarjetaElemento>
  );
}

export default function ConcretePanel() {
  const t = useT();
  const elementos = useProjectStore((s) => s.concreteElements);
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const agregar = useProjectStore((s) => s.addConcreteElement);
  const tot = totalesConcreto(elementos);

  const onAgregar = (tipo: TipoConcreto) => {
    const n = elementos.filter((e) => e.tipo === tipo).length + 1;
    agregar({
      tipo,
      nombre: t('el.defaultName', { type: t(`concreteType.${tipo}`), n }),
      cantidad: 1,
      ...dimensionesPorDefecto(tipo),
      desperdicio: DESPERDICIO_CONCRETO_POR_DEFECTO,
      notas: '',
    });
  };

  return (
    <PanelModulo
      titulo={t('concrete.heading', { count: elementos.length })}
      tipos={TIPOS_CONCRETO.map((tp) => ({ valor: tp, texto: t(`concreteType.${tp}`) }))}
      onAgregar={onAgregar}
      vacio={elementos.length === 0}
      hijos={elementos.map((e) => (
        <Elemento key={e.id} e={e} />
      ))}
      totales={
        <Resultados
          filas={[
            { etiqueta: t('el.netVolume'), valor: formatearVolumen(tot.neto, sistema) },
            { etiqueta: t('el.orderVolume'), valor: formatearVolumen(tot.pedido, sistema), destacado: true },
          ]}
        />
      }
      nota={t('concrete.note')}
    />
  );
}
