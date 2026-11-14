import type { VisionEffect, VisionObstacle, VisionPoint } from '../models/vision';
import type { PreviewToken, SightDisk } from './vision-preview';

export const isVisionDoor = (obstacle: Pick<VisionObstacle, 'kind'>): boolean =>
  obstacle.kind === 'door' || obstacle.kind === 'door-window';

export const visionCenter = (token: PreviewToken, grid: number): { x: number; y: number } => ({ x: token.x + token.size * grid / 2, y: token.y + token.size * grid / 2 });
export function effectDisks(effect: VisionEffect, tokens: readonly PreviewToken[], grid: number): SightDisk[] {
  if (effect.scope.kind === 'tokens') return tokens.filter((token) => effect.scope.kind === 'tokens' && effect.scope.tokenIds.includes(token.instanceId))
    .map((token) => ({ ...visionCenter(token, grid), radius: token.size * grid / Math.SQRT2 }));
  if (effect.scope.radiusFeet === 0) return [];
  const anchor = effect.anchorTokenId ? tokens.find((token) => token.instanceId === effect.anchorTokenId) : undefined;
  if (effect.anchorTokenId && !anchor) return [];
  return [{ ...(anchor ? visionCenter(anchor, grid) : effect.scope), radius: effect.scope.radiusFeet * .3048 / 1.5 * grid }];
}

/** Sombras del mismo plano utilizadas por vista actual y memoria vectorial. */
export function obstacleShadows(obstacles: readonly VisionObstacle[], origin: VisionPoint,
  channel: 'blocksSight' | 'blocksEffect', width=1536, height=1024): VisionPoint[][] {
  const extent=Math.hypot(width,height)*4;
  return obstacles.filter(o=>o[channel]&&!(isVisionDoor(o)&&o.open)).map(o=>{
    const far=(p:VisionPoint)=>{const d=Math.hypot(p.x-origin.x,p.y-origin.y);return {x:p.x+(p.x-origin.x)/(d||1)*extent,y:p.y+(p.y-origin.y)/(d||1)*extent};};
    return [{...o.start},{...o.end},far(o.end),far(o.start)];
  });
}
