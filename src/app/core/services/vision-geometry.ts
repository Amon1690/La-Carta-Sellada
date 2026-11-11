import type { VisionEffect, VisionObstacle } from '../models/vision';
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
