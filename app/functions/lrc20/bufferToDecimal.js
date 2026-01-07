export default function tokenBufferAmountToDecimal(buffer) {
  const bytes = Uint8Array.from(Object.values(buffer));

  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const decimal = BigInt('0x' + hex);

  return decimal;
}
