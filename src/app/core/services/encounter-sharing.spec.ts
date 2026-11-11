import { SharingSnapshot, renderPersonalView } from './encounter-sharing';
import { emptyBoardVision } from './vision-state';

describe('Imagen personal de encuentros', () => {
  let snapshot: SharingSnapshot;
  let load: jasmine.Spy;
  beforeEach(() => {
    snapshot = {
      sheetRevision: 0, title: 'Encuentro', mapUrl: 'mapa-original', fog: [], actors: ['hero'],
      vision: { ...emptyBoardVision(), enabled: true, obstacles: [],
        environment: { illumination: 'bright', weather: 'clear', timeOfDay: 'day' },
        groups: [{ id: 'director', name: 'Otra vista', observerIds: ['other'] }], activeGroupId: 'director' },
      profiles: new Map(['hero', 'other'].map((id) => [id, { version: 1, senses: [{ sense: 'normal', rangeFeet: 10, source: { kind: 'director', reference: 'Prueba' } }] }])),
      tokens: [
        { instanceId: 'hero', actorId: 'player:hero', x: 100, y: 100, size: 1, hidden: false, conditions: [], image: 'propia', name: 'Héroe' },
        { instanceId: 'other', actorId: 'player:other', x: 1000, y: 100, size: 1, hidden: false, conditions: [], image: 'ajena', name: 'Otro' },
        { instanceId: 'secret', actorId: 'npc:secret', x: 160, y: 100, size: 1, hidden: true, conditions: [], image: 'secreta', name: 'Secreto' },
      ],
    };
    const map = document.createElement('canvas'); map.width = 1536; map.height = 1024;
    const ctx = map.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, map.width, map.height);
    load = jasmine.createSpy('load').and.resolveTo(map);
  });
  async function pixels(id = 'hero'): Promise<CanvasRenderingContext2D> {
    const view = await renderPersonalView(snapshot, id, load);
    const image = new Image(); image.src = view.image; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0); return ctx;
  }
  const color = (ctx: CanvasRenderingContext2D, x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
  it('los miembros de la lista activa reciben la unión real y retirar un miembro restaura su vista individual', async () => {
    snapshot.vision.groups[0].observerIds = ['hero', 'other'];
    expect(color(await pixels('hero'), 1080, 80)).toEqual([255, 0, 0, 255]);
    expect(color(await pixels('other'), 180, 80)).toEqual([255, 0, 0, 255]);
    snapshot.vision.groups[0].observerIds = ['hero'];
    expect(color(await pixels('hero'), 1080, 80)).toEqual([9, 12, 16, 255]);
    expect(color(await pixels('other'), 180, 80)).toEqual([9, 12, 16, 255]);
  });
  it('no usa listas inactivas ni observadores ocultos y mantiene opaca la exploración de una vista compartida', async () => {
    snapshot.vision.groups.push({ id: 'inactive', name: 'Otra lista', observerIds: ['hero', 'other'] });
    expect(color(await pixels('hero'), 1080, 80)).toEqual([9, 12, 16, 255]);
    snapshot.vision.groups[0].observerIds = ['hero', 'other', 'secret']; snapshot.tokens[1].hidden = true;
    snapshot.profiles.set('secret', { version: 1, senses: [{ sense: 'normal', rangeFeet: null, source: { kind: 'director', reference: 'Oculto de prueba' } }] });
    expect(color(await pixels('hero'), 1080, 80)).toEqual([9, 12, 16, 255]);
    expect(load.calls.allArgs().flat()).not.toContain('secreta');
    snapshot.tokens[1].hidden = false; snapshot.fog = [{ x: 1050, y: 50, width: 80, height: 80 }];
    expect(color(await pixels('hero'), 1080, 80)).toEqual([9, 12, 16, 255]);
    snapshot.tokens[0].hidden = true; load.calls.reset(); await pixels('hero'); expect(load).not.toHaveBeenCalled();
  });
  it('solo rasteriza líneas de puertas dentro de la visión y nunca líneas de paredes o ventanas', async () => {
    const source = { kind: 'director' as const, reference: 'Trazados sintéticos' };
    snapshot.vision.obstacles = (['wall', 'window', 'door', 'door-window'] as const).map((kind, i) => ({
      id: kind, name: kind, kind, start: { x: 150 + i * 15, y: 65 }, end: { x: 150 + i * 15, y: 90 },
      blocksSight: false, blocksEffect: false, source, ...(['door', 'door-window'].includes(kind) ? { open: false } : {}) }));
    let ctx = await pixels();
    expect(color(ctx, 150, 75)).toEqual([255, 0, 0, 255]); expect(color(ctx, 165, 75)).toEqual([255, 0, 0, 255]);
    expect(color(ctx, 180, 75)).toEqual([233, 189, 102, 255]); expect(color(ctx, 195, 75)).toEqual([233, 189, 102, 255]);
    snapshot.fog = [{ x: 175, y: 60, width: 30, height: 35 }];
    ctx = await pixels(); expect(color(ctx, 180, 75)).toEqual([9, 12, 16, 255]);
    snapshot.fog = []; snapshot.vision.obstacles[2].start.x = snapshot.vision.obstacles[2].end.x = 1000;
    expect(color(await pixels(), 1000, 75)).toEqual([9, 12, 16, 255]);
  });
  it('descarta el mapa fuera de la vista personal antes de enviarlo e ignora la lista de dirección', async () => {
    const ctx = await pixels();
    expect(color(ctx, 180, 100)).toEqual([255, 0, 0, 255]);
    expect(color(ctx, 1000, 100)).toEqual([9, 12, 16, 255]);
    expect(load.calls.allArgs().flat()).not.toContain('ajena');
    expect(load.calls.allArgs().flat()).not.toContain('secreta');
  });
  it('conserva la niebla aunque la capa del director esté oculta', async () => {
    snapshot.fog = [{ x: 170, y: 90, width: 40, height: 40 }];
    expect(color(await pixels(), 180, 100)).toEqual([9, 12, 16, 255]);
  });
  it('dos personajes reciben imágenes distintas por instancia', async () => {
    const a = await renderPersonalView(snapshot, 'hero', load), b = await renderPersonalView(snapshot, 'other', load);
    expect(a.image).not.toBe(b.image);
    expect(color(await pixels('other'), 180, 100)).toEqual([9, 12, 16, 255]);
  });
  it('no carga el mapa sin datos confirmados, con ceguera o con observador oculto', async () => {
    snapshot.profiles.clear(); expect((await renderPersonalView(snapshot, 'hero', load)).pending).toBeTrue();
    expect(load).not.toHaveBeenCalled();
    snapshot.profiles.set('hero', { version: 1, senses: [{ sense: 'normal', rangeFeet: null, source: { kind: 'director', reference: 'Prueba' } }] });
    snapshot.tokens[0].conditions = ['blinded']; await renderPersonalView(snapshot, 'hero', load);
    snapshot.tokens[0].conditions = []; snapshot.tokens[0].hidden = true; await renderPersonalView(snapshot, 'hero', load);
    expect(load).not.toHaveBeenCalled();
  });
  it('en oscuridad entrega el token propio y contiguos, sin entregar el mapa ni tokens lejanos u ocultos', async () => {
    snapshot.vision.environment.illumination = 'darkness';
    snapshot.tokens[1].x = 151.2;
    const ctx = await pixels();
    expect(color(ctx, 125, 125)).toEqual([255, 0, 0, 255]); expect(color(ctx, 176, 125)).toEqual([255, 0, 0, 255]);
    expect(color(ctx, 180, 80)).toEqual([9, 12, 16, 255]);
    expect(load.calls.allArgs().flat()).toEqual(['propia', 'ajena']); expect(load.calls.allArgs().flat()).not.toContain('mapa-original');
    snapshot.tokens[1].x = 1000; load.calls.reset(); await pixels(); expect(load.calls.allArgs().flat()).toEqual(['propia']);
    snapshot.tokens[0].hidden = true; load.calls.reset(); await pixels(); expect(load).not.toHaveBeenCalled();
  });
  it('recorta una fuente de luz y sus exclusiones en el raster sin revelar el mapa original', async () => {
    const source = { kind: 'director' as const, reference: 'Luz de prueba' };
    snapshot.vision.environment.illumination = 'darkness';
    snapshot.vision.effects = [{ id: 'light', name: 'Luz', kind: 'light', illumination: 'bright', source,
      scope: { kind: 'circle', x: 180, y: 100, radiusFeet: 5 }, active: true, duration: { kind: 'until-ended' } }];
    const lit = await pixels();
    expect(color(lit, 180, 100)).toEqual([255, 0, 0, 255]); expect(color(lit, 80, 100)).toEqual([9, 12, 16, 255]);
    snapshot.vision.effects.push({ id: 'dark', name: 'Oscuridad mágica', kind: 'magical-darkness', source,
      scope: { kind: 'circle', x: 180, y: 100, radiusFeet: 2 }, active: true, duration: { kind: 'until-ended' } });
    expect(color(await pixels(), 180, 100)).toEqual([9, 12, 16, 255]);
  });
  it('el efecto cosmético de niebla se limita al área visible', async () => {
    snapshot.vision.environment.weather = 'fog'; snapshot.vision.environment.obscurement = 'light'; const ctx = await pixels();
    expect(color(ctx, 180, 100)).not.toEqual([9, 12, 16, 255]);
    expect(color(ctx, 1000, 100)).toEqual([9, 12, 16, 255]);
  });
  it('recorta paredes también en el raster y una puerta abierta deja pasar', async () => {
    const source = { kind: 'director' as const, reference: 'Puerta sintética' };
    snapshot.vision.obstacles = [{ id: 'door', name: 'Puerta', kind: 'door', open: false, start: { x: 150, y: 0 }, end: { x: 150, y: 300 }, blocksSight: true, blocksEffect: true, source }];
    expect(color(await pixels(), 180, 100)).toEqual([9, 12, 16, 255]);
    snapshot.vision.obstacles[0].open = true; expect(color(await pixels(), 180, 100)).toEqual([255, 0, 0, 255]);
  });
  it('no carga la imagen ni el nombre de una ficha con condiciones pendientes y vista normal', async () => {
    snapshot.tokens[2].hidden = false; snapshot.tokens[2].conditions = undefined;
    await pixels(); expect(load.calls.allArgs().flat()).not.toContain('secreta');
    snapshot.tokens[0].conditions = undefined; load.calls.reset();
    const result = await renderPersonalView(snapshot, 'hero', load); expect(result.pending).toBeTrue(); expect(load).not.toHaveBeenCalled();
  });
  it('un token oculto conserva sus efectos de ocultación en el raster y no revela su imagen', async () => {
    const source = { kind: 'director' as const, reference: 'Ocultación de prueba' };
    snapshot.vision.effects = [{ id: 'dark', name: 'Oscuridad', kind: 'magical-darkness', source,
      scope: { kind: 'tokens', tokenIds: ['secret'] }, active: true, duration: { kind: 'until-ended' } }];
    expect(color(await pixels(), 180, 100)).toEqual([9, 12, 16, 255]);
    expect(load.calls.allArgs().flat()).not.toContain('secreta');
  });
  it('el raster tampoco revela el mapa detrás de una nube de ocultación fuerte', async () => {
    snapshot.profiles.set('hero', { version: 1, senses: [{ sense: 'normal', rangeFeet: 60, source: { kind: 'director', reference: 'Prueba' } }] });
    snapshot.vision.effects = [{ id: 'heavy', name: 'Nube', kind: 'obscurement', obscurement: 'heavy', source: { kind: 'director', reference: 'Prueba' },
      scope: { kind: 'circle', x: 200, y: 125.6, radiusFeet: 2 }, active: true, duration: { kind: 'until-ended' } }];
    expect(color(await pixels(), 400, 125)).toEqual([9, 12, 16, 255]);
  });
});
