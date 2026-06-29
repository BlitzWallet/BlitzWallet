// Maps a place's material `icon` name to a high-level filter category.
// The buckets mirror the groupings already documented in `iconMaping.js`.

export const BTC_MAP_CATEGORIES = [
  'food_drink',
  'retail',
  'lodging',
  'services',
  'atm',
  'fuel',
  'leisure',
  'other',
];

// Lucide icon + i18n label key for each category (used by the filter pills).
export const CATEGORY_META = {
  food_drink: {
    icon: 'Utensils',
    labelKey: 'screens.btcMap.categories.food_drink',
  },
  retail: { icon: 'ShoppingBag', labelKey: 'screens.btcMap.categories.retail' },
  lodging: { icon: 'BedDouble', labelKey: 'screens.btcMap.categories.lodging' },
  services: { icon: 'Wrench', labelKey: 'screens.btcMap.categories.services' },
  atm: { icon: 'Banknote', labelKey: 'screens.btcMap.categories.atm' },
  fuel: { icon: 'Fuel', labelKey: 'screens.btcMap.categories.fuel' },
  leisure: { icon: 'Gamepad2', labelKey: 'screens.btcMap.categories.leisure' },
  other: { icon: 'MapPin', labelKey: 'screens.btcMap.categories.other' },
};

const CATEGORY_BY_ICON = {};
const assign = (category, names) => {
  for (const name of names) CATEGORY_BY_ICON[name] = category;
};

assign('food_drink', [
  'restaurant',
  'fast_food',
  'local_cafe',
  'coffee',
  'emoji_food_beverage',
  'local_bar',
  'sports_bar',
  'lunch_dining',
  'bakery_dining',
  'tapas',
  'local_pizza',
  'icecream',
  'cake',
  'wine_bar',
  'liquor',
  'outdoor_grill',
  'cooking',
]);

assign('retail', [
  'local_grocery_store',
  'shopping_cart',
  'local_mall',
  'diamond',
  'watch',
  'smartphone',
  'computer',
  'toys',
  'games',
  'videogame_asset',
  'music_note',
  'piano',
  'luggage',
  'checkroom',
  'local_florist',
  'grass',
  'potted_plant',
  'card_giftcard',
  'menu_book',
  'chair',
  'hardware',
  'local_printshop',
  'newspaper',
]);

assign('lodging', ['hotel', 'chalet', 'camping', 'home', 'roofing']);

assign('atm', ['local_atm', 'currency_exchange']);

assign('fuel', ['local_gas_station']);

assign('services', [
  'medical_services',
  'local_pharmacy',
  'local_hospital',
  'dentistry',
  'visibility',
  'spa',
  'car_repair',
  'local_laundry_service',
  'cleaning_services',
  'electrical_services',
  'electric_bolt',
  'plumbing',
  'build',
  'construction',
  'engineering',
  'architecture',
  'design_services',
  'hvac',
  'account_balance',
  'attach_money',
  'balance',
  'directions_car',
  'local_taxi',
  'car_rental',
  'minor_crash',
  'pedal_bike',
  'two_wheeler',
  'airport_shuttle',
  'commute',
  'flight_takeoff',
  'directions_boat',
  'boat',
  'sailing',
  'local_post_office',
  'mail',
  'local_police',
  'school',
  'surgical',
  'imagesearch_roller',
  'carpenter',
  'science',
  'translate',
  'photo_camera',
  'video',
  'videocam',
]);

assign('leisure', [
  'fitness_center',
  'sports',
  'sports_score',
  'sports_hockey',
  'sports_handball',
  'sports_soccer',
  'sports_martial_arts',
  'golf_course',
  'beach_access',
  'park',
  'nature_people',
  'pool',
  'surfing',
  'kitesurfing',
  'kayaking',
  'scuba_diving',
  'paragliding',
  'attractions',
  'casino',
  'celebration',
  'nightlife',
  'sauna',
  'stadium',
  'museum',
  'local_movies',
  'church',
  'palette',
  'mic',
  'tour',
  'castle',
  'pets',
  'cruelty_free',
]);

export function getBtcMapCategory(materialIconName) {
  return CATEGORY_BY_ICON[materialIconName] ?? 'other';
}
