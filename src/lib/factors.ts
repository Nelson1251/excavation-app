// Factores de conversión de volúmenes de tierra.

/** Volumen suelto (tras excavar) a partir del volumen en banco y el abundamiento (fracción). */
export function looseVolume(bankM3: number, swell: number): number {
  return bankM3 * (1 + swell);
}

/**
 * Material en banco necesario para obtener un volumen compactado,
 * dada la contracción por compactación (fracción, 0 ≤ shrink < 1).
 */
export function fillMaterialNeeded(compactedM3: number, shrink: number): number {
  if (shrink >= 1) throw new Error('La contracción debe ser menor que 1 (100 %).');
  return compactedM3 / (1 - shrink);
}

/** Número de viajes de camión (redondeado hacia arriba). */
export function truckTrips(looseM3: number, capacityM3: number): number {
  if (capacityM3 <= 0 || looseM3 <= 0) return 0;
  return Math.ceil(looseM3 / capacityM3);
}
