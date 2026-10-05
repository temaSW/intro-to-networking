// The angle is in degrees at the UI boundary; calculations use radians.
export function complexVector(modulus, angleDegrees) {
  const radians = angleDegrees * Math.PI / 180;
  return {
    modulus,
    angleDegrees: modulus === 0 ? null : angleDegrees,
    real: modulus * Math.cos(radians),
    imaginary: modulus * Math.sin(radians),
  };
}
