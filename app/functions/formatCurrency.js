export const formatCurrency = ({amount, code}) => {
  const commaFormatted = String(amount).replace(
    /(\d)(?=(\d{3})+(?!\d))/g,
    '$1 ',
  );
  const periodFormatted = String(amount)
    .replace('.', ',')
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ');

  const switchOptions = {
    // united arab emirates dirham (ex: AED 1,234.56)
    AED: [`د.إ ${commaFormatted}`, `${commaFormatted}`, 'د.إ', true],

    // Afghanistan Afghani (using comma formatting)
    AFN: [`؋ ${commaFormatted}`, `${commaFormatted}`, '؋', true],

    // Albania Lek (using comma formatting)
    ALL: [`Lek ${commaFormatted}`, `${commaFormatted}`, 'Lek', true],

    // Armenia Dram (using comma formatting)
    AMD: [`֏${commaFormatted}`, `${commaFormatted}`, '֏', true],

    // Netherlands Antilles Guilder (ex: ANG 1,234.56)
    ANG: [`ƒ ${commaFormatted}`, `${commaFormatted}`, 'ƒ', true],

    // Angola Kwanza (using comma formatting)
    AOA: [`Kz ${commaFormatted}`, `${commaFormatted}`, 'Kz', true],

    // argentine peso (ex: $ 1.234,56)
    ARS: [`$ ${periodFormatted}`, `${periodFormatted}`, '$', true],

    // australian dollar (ex: $ 1,234.56)
    AUD: [`$ ${commaFormatted}`, `${commaFormatted}`, '$', true],

    // Aruba Guilder (using comma formatting)
    AWG: [`ƒ${commaFormatted}`, `${commaFormatted}`, 'ƒ', true],

    // Azerbaijan Manat (using comma formatting)
    AZN: [`₼${commaFormatted}`, `${commaFormatted}`, '₼', true],

    // bosnia and herzegovina convertible mark (ex: KM 1.234,56)
    BAM: [`KM ${commaFormatted}`, `${commaFormatted}`, 'KM', true],

    // barbadian Dollar (ex: $1.234,56)
    BBD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],

    // Bangladesh Taka (using comma formatting)
    BDT: [`৳${commaFormatted}`, `${commaFormatted}`, '৳', true],

    // Bahrain Dinar (using comma formatting)
    BHD: [`BD ${commaFormatted}`, `${commaFormatted}`, 'BD', true],

    // Burundi Franc (using comma formatting)
    BIF: [`FBu ${commaFormatted}`, `${commaFormatted}`, 'FBu', true],

    // Bermuda Dollar (using comma formatting)
    BMD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],

    // Brunei Darussalam Dollar (using comma formatting)
    BND: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],

    // bolivian Boliviano (ex: $b 1.234,56)
    BOB: [`$b ${commaFormatted}`, `${commaFormatted}`, '$b', true],

    // Brazilian Real (ex: R$ 1.234,56)
    BRL: [`R$ ${periodFormatted}`, `${periodFormatted}`, 'R$', true],

    // Bhutan Ngultrum (using comma formatting)
    BTN: [`Nu.${commaFormatted}`, `${commaFormatted}`, 'Nu.', true],

    // Botswana Pula (using comma formatting)
    BWP: [`P${commaFormatted}`, `${commaFormatted}`, 'P', true],

    // Belarus Ruble (using comma formatting)
    BYN: [`Br${commaFormatted}`, `${commaFormatted}`, 'Br', true],

    // Belize Dollar (using comma formatting)
    BZD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],

    // bulgarian lev (ex: лв1,234.56)
    BGN: [`лв${commaFormatted}`, `${commaFormatted}`, 'лв', true],

    // bahamian Dollar (ex: $1,234,56)
    BSD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],

    // canadian dollar (ex: $ 1,234.56)
    CAD: [`$ ${commaFormatted}`, `${commaFormatted}`, '$', true],

    // swiss franc (ex: fr. 1.234,56)
    CHF: [`fr. ${periodFormatted}`, `${periodFormatted}`, 'fr.', true],

    // chilean peso (ex: $ 1,234.56)
    CLP: [`$ ${commaFormatted}`, `${commaFormatted}`, '$', true],

    // yuan renminbi (ex: ¥ 1,234.56)
    CNY: [`¥ ${commaFormatted}`, `${commaFormatted}`, '¥', true],

    // colombian peso (ex: $ 1,234.56)
    COP: [`$ ${commaFormatted}`, `${commaFormatted}`, '$', true],

    // costa rican colón (ex: ₡1.234,56)
    CRC: [`₡${periodFormatted}`, `${periodFormatted}`, '₡', true],

    // czech koruna (ex: 1.234,56 Kč)
    CZK: [`${periodFormatted} Kč`, `${periodFormatted}`, 'Kč', false],

    // danish krone (ex: kr. 1.234,56)
    DKK: [`kr. ${periodFormatted}`, `${periodFormatted}`, 'kr.', true],

    // dominican Peso (ex: RD$ 1,234.56)
    DOP: [`RD$ ${commaFormatted}`, `${commaFormatted}`, 'RD$', true],

    // european union (ex: €1.234,56)
    EUR: [`€${periodFormatted}`, `${periodFormatted}`, '€', true],

    // uk/great britain pound sterling (ex: £1,234.56)
    GBP: [`£${commaFormatted}`, `${commaFormatted}`, '£', true],

    // georgian lari (ex: ₾1,234.56)
    GEL: [`₾${commaFormatted}`, `${commaFormatted}`, '₾', true],

    // guatemalan quetzal (ex: Q1,234.56)
    GTQ: [`Q${commaFormatted}`, `${commaFormatted}`, 'Q', true],

    // hong kong dollar (ex: HK$ 1,234.56)
    HKD: [`HK$ ${commaFormatted}`, `${commaFormatted}`, 'HK$', true],

    // honduran lempira (ex: L 1,234.56)
    HNL: [`L ${commaFormatted}`, `${commaFormatted}`, 'L', true],

    // croatian kuna (ex: 1,234.56 kn)
    HRK: [`${commaFormatted} kn`, `${commaFormatted}`, 'kn', false],

    // hungarian forint (ex: 1.234,56 Ft)
    HUF: [`${periodFormatted} Ft`, `${periodFormatted}`, 'Ft', false],

    // indonesian rupiah (ex: Rp 1,234.56)
    IDR: [`Rp ${commaFormatted}`, `${commaFormatted}`, 'Rp', true],

    // new israeli shekel (ex: ₪ 1.234,56)
    ILS: [`₪ ${periodFormatted}`, `${periodFormatted}`, '₪', true],

    // indian rupee (ex: ₹ 1,234.56)
    INR: [`₹ ${commaFormatted}`, `${commaFormatted}`, '₹', true],

    // icelandic krona (ex: kr. 1.234,56)
    ISK: [`kr. ${periodFormatted}`, `${periodFormatted}`, 'kr.', true],

    // jamaican dollar (ex: J$ 1,234.56)
    JMD: [`J$ ${commaFormatted}`, `${commaFormatted}`, 'J$', true],

    // yen (ex: ¥ 1,234.56)
    JPY: [`¥ ${commaFormatted}`, `${commaFormatted}`, '¥', true],

    KES: [`KSh ${commaFormatted}`, `${commaFormatted}`, 'KSh', true],

    LBP: [`L£ ${commaFormatted}`, `${commaFormatted}`, 'L£', true],

    // won (ex: ₩ 1,234.56)
    KRW: [`₩ ${commaFormatted}`, `${commaFormatted}`, '₩', true],

    // moroccan dirham (ex: 1,234.56 .د.م.)
    MAD: [`${commaFormatted} .د.م.`, `${commaFormatted}`, '.د.م.', false],

    // moldovan leu (ex: 1.234,56 L)
    MDL: [`${commaFormatted} L`, `${commaFormatted}`, 'L', false],

    // mexican peso (ex: $ 1,234.56)
    MXN: [`$ ${commaFormatted}`, `${commaFormatted}`, '$', true],

    // malaysian ringgit (ex: RM 1,234.56)
    MYR: [`RM ${commaFormatted}`, `${commaFormatted}`, 'RM', true],

    NAD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],

    // nigerian naira (ex: ₦1,234.56)
    NGN: [`₦${commaFormatted}`, `${commaFormatted}`, '₦', true],

    // nicaraguan Córdoba (ex: C$ 1,234.56)
    NIO: [`C$ ${commaFormatted}`, `${commaFormatted}`, 'C$', true],

    // norwegian krone (ex: kr 1,234.56)
    NOK: [`kr ${commaFormatted}`, `${commaFormatted}`, 'kr', true],

    // new zealand dollar (ex: $ 1,234.56)
    NZD: [`$ ${commaFormatted}`, `${commaFormatted}`, '$', true],

    // panamanian balboa (ex: B/. 1,234.56)
    PAB: [`B/. ${commaFormatted}`, `${commaFormatted}`, 'B/.', true],

    PEN: [`S/. ${commaFormatted}`, `${commaFormatted}`, 'S/.', true],
    PGK: [`K ${commaFormatted}`, `${commaFormatted}`, 'K', true],
    PHP: [`₱ ${commaFormatted}`, `${commaFormatted}`, '₱', true],
    PKR: [`Rs ${commaFormatted}`, `${commaFormatted}`, 'Rs', true],
    PLN: [`${periodFormatted} zł`, `${periodFormatted}`, 'zł', false],
    PYG: [`₲${commaFormatted}`, `${commaFormatted}`, '₲', true],
    QAR: [`QR ${commaFormatted}`, `${commaFormatted}`, 'QR', true],
    RON: [`${commaFormatted}L`, `${commaFormatted}`, 'L', false],
    RSD: [`${commaFormatted} Дин.`, `${commaFormatted}`, 'Дин.', false],
    RUB: [`${periodFormatted} ₽`, `${periodFormatted}`, '₽', false],
    RWF: [`RF ${commaFormatted}`, `${commaFormatted}`, 'RF', true],
    SAR: [`${commaFormatted} ﷼`, `${commaFormatted}`, '﷼', false],
    SBD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],
    SCR: [`Rs ${commaFormatted}`, `${commaFormatted}`, 'Rs', true],
    SDG: [`£ ${commaFormatted}`, `${commaFormatted}`, '£', true],
    SEK: [`${periodFormatted} kr`, `${periodFormatted}`, 'kr', false],
    SGD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],
    SHP: [`£${commaFormatted}`, `${commaFormatted}`, '£', true],
    SLL: [`Le ${commaFormatted}`, `${commaFormatted}`, 'Le', true],
    SOS: [`Sh ${commaFormatted}`, `${commaFormatted}`, 'Sh', true],
    SPL: [`${commaFormatted} SPL`, `${commaFormatted}`, 'SPL', false],
    SRD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],
    STN: [`Db ${commaFormatted}`, `${commaFormatted}`, 'Db', true],
    SVC: [`₡${commaFormatted}`, `${commaFormatted}`, '₡', true],
    SYP: [`£S ${commaFormatted}`, `${commaFormatted}`, '£S', true],
    SZL: [`L ${commaFormatted}`, `${commaFormatted}`, 'L', true],
    THB: [`${commaFormatted} ฿`, `${commaFormatted}`, '฿', false],
    TJS: [`SM ${commaFormatted}`, `${commaFormatted}`, 'SM', true],
    TMT: [`m ${commaFormatted}`, `${commaFormatted}`, 'm', true],
    TND: [`DT ${commaFormatted}`, `${commaFormatted}`, 'DT', true],
    TOP: [`T$ ${commaFormatted}`, `${commaFormatted}`, 'T$', true],
    TRY: [`${commaFormatted} ₺`, `${commaFormatted}`, '₺', false],
    TTD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],
    TVD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],
    TWD: [`元 ${commaFormatted}`, `${commaFormatted}`, '元', true],
    TZS: [`Sh ${commaFormatted}`, `${commaFormatted}`, 'Sh', true],
    UAH: [`₴${commaFormatted}`, `${commaFormatted}`, '₴', true],
    UGX: [`Sh ${commaFormatted}`, `${commaFormatted}`, 'Sh', true],
    USD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],
    UYU: [`$U${periodFormatted}`, `${periodFormatted}`, '$U', true],
    UZS: [`so'm ${commaFormatted}`, `${commaFormatted}`, `so'm`, true],
    VEF: [`Bs ${commaFormatted}`, `${commaFormatted}`, 'Bs', true],
    VES: [`Bs ${commaFormatted}`, `${commaFormatted}`, 'Bs', true],
    VND: [`${periodFormatted} ₫`, `${periodFormatted}`, '₫', false],
    VUV: [`VT ${commaFormatted}`, `${commaFormatted}`, 'VT', true],
    WST: [`WS$ ${commaFormatted}`, `${commaFormatted}`, 'WS$', true],
    XAF: [`FCFA ${commaFormatted}`, `${commaFormatted}`, 'FCFA', true],
    XCD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],
    XDR: [`SDR ${commaFormatted}`, `${commaFormatted}`, 'SDR', true],
    XOF: [`CFA ${commaFormatted}`, `${commaFormatted}`, 'CFA', true],
    XPF: [`F ${commaFormatted}`, `${commaFormatted}`, 'F', true],
    YER: [`﷼ ${commaFormatted}`, `${commaFormatted}`, '﷼', true],
    ZAR: [`R ${commaFormatted}`, `${commaFormatted}`, 'R', true],
    ZMW: [`K ${commaFormatted}`, `${commaFormatted}`, 'K', true],
    ZWD: [`$${commaFormatted}`, `${commaFormatted}`, '$', true],

    // Existing code remains the same, adding these to the switchOptions object:
    // default
    DEFAULT: [amount.toString(), amount.toString(), ''],
  };
  const upperCode = code?.toUpperCase();
  return switchOptions[upperCode] || switchOptions.DEFAULT;
};
