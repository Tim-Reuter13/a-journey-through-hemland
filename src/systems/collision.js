export function circleIntersectsBox(x, z, radius, bx, bz, halfWidth, halfDepth, rotation) {
  const dx = x - bx, dz = z - bz, c = Math.cos(rotation), s = Math.sin(rotation);
  const localX = dx * c - dz * s, localZ = dx * s + dz * c;
  const nearestX = Math.max(-halfWidth, Math.min(halfWidth, localX));
  const nearestZ = Math.max(-halfDepth, Math.min(halfDepth, localZ));
  return (localX - nearestX) ** 2 + (localZ - nearestZ) ** 2 <= radius ** 2;
}
