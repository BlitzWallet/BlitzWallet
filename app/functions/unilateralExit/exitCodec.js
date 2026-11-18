// bigint-safe JSON: bigint <-> {"$bigint":"<decimal>"}. Plain JSON otherwise.
export const encodeRecovery = obj =>
  JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? { $bigint: v.toString() } : v,
  );

export const decodeRecovery = str =>
  JSON.parse(str, (_, v) =>
    v && typeof v === 'object' && typeof v.$bigint === 'string'
      ? BigInt(v.$bigint)
      : v,
  );
