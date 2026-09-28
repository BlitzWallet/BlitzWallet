import parseStandardSeedQR from '../../app/functions/parseStandardSeedQR';
import calculateSeedQR from '../../app/components/admin/homeComponents/settingsContent/seedQR';

describe('parseStandardSeedQR', () => {
  const mnemonic =
    'forum undo fragile fade shy sign arrest garment culture tube off merit';
  const encoded = '073318950739065415961602009907670428187212261116';

  test('decodes a 12-word Standard SeedQR and matches our QR generator', () => {
    expect(calculateSeedQR(mnemonic)).toBe(encoded);
    expect(parseStandardSeedQR(encoded)).toEqual(mnemonic.split(' '));
    expect(
      parseStandardSeedQR('080301540200062600251559007008931730078802752004'),
    ).toEqual(
      'good battle boil exact add seed angle hurry success glad carbon whisper'.split(
        ' ',
      ),
    );
  });

  test('rejects malformed and unsupported scans', () => {
    const invalidScans = [
      '1',
      `-001${encoded.slice(4)}`,
      `1e3 ${encoded.slice(4)}`,
      `0x1f${encoded.slice(4)}`,
      String.fromCharCode(
        ...Uint8Array.from(Buffer.from('5bbd9d71a8ec7990831aff359d426545', 'hex')),
      ),
      `${encoded}0000`,
      `${encoded.slice(0, 44)}2048`,
      '011416550964188800731119157218870156061002561932122514430573003611011405110613292018175411971576',
    ];

    invalidScans.forEach(scan => {
      expect(parseStandardSeedQR(scan)).toBeNull();
    });
  });
});
