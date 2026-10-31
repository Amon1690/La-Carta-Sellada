import {
  TRAVEL_EVENTS,
  TRAVEL_EVENT_CATALOG_STATS,
} from './travel-events';

describe('catálogo de eventos de viaje', () => {
  it('incluye el mínimo solicitado para cada rol', () => {
    expect(TRAVEL_EVENT_CATALOG_STATS.guide).toBeGreaterThanOrEqual(300);
    expect(TRAVEL_EVENT_CATALOG_STATS.hunter).toBeGreaterThanOrEqual(100);
    expect(TRAVEL_EVENT_CATALOG_STATS.watch).toBeGreaterThanOrEqual(100);
  });

  it('reserva al menos un diez por ciento para encuentros', () => {
    expect(TRAVEL_EVENT_CATALOG_STATS.encounterRatio).toBeGreaterThanOrEqual(0.1);
  });

  it('mantiene identificadores únicos y microhistorias completas', () => {
    expect(new Set(TRAVEL_EVENTS.map((event) => event.id)).size).toBe(
      TRAVEL_EVENTS.length
    );
    for (const event of TRAVEL_EVENTS) {
      expect(event.title.length).toBeGreaterThan(0);
      expect(event.story.length).toBeGreaterThan(40);
      expect(event.success.length).toBeGreaterThan(0);
      expect(event.failure.length).toBeGreaterThan(0);
      expect(event.environments.length).toBeGreaterThan(0);
    }
  });
});
