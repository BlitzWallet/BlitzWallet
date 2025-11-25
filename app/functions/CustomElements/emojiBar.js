import React, { useCallback, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CONTENT_KEYBOARD_OFFSET, SIZES } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import ThemeText from './textTheme';
import i18next from 'i18next';

// Emojis mapped to keywords
const EMOJI_KEYWORDS = {
  en: {
    '🍕': ['pizza', 'food', 'dinner', 'lunch'],
    '🍔': ['burger', 'food', 'dinner', 'lunch', 'mcdonalds', 'fast food'],
    '🌮': ['taco', 'food', 'dinner', 'lunch', 'mexican'],
    '🍜': ['ramen', 'noodles', 'food', 'dinner', 'lunch', 'soup'],
    '🍣': ['sushi', 'food', 'dinner', 'lunch', 'japanese'],
    '🍺': ['beer', 'drink', 'bar', 'drinks', 'alcohol'],
    '🍻': ['beers', 'drinks', 'bar', 'cheers', 'alcohol'],
    '☕': ['coffee', 'cafe', 'starbucks', 'drink', 'breakfast'],
    '🍷': ['wine', 'drink', 'drinks', 'alcohol', 'dinner'],
    '🥂': ['champagne', 'drinks', 'celebrate', 'cheers', 'alcohol'],
    '🎉': ['party', 'celebrate', 'birthday', 'celebration'],
    '🎂': ['cake', 'birthday', 'dessert', 'celebration'],
    '🎁': ['gift', 'present', 'birthday', 'celebration'],
    '🎮': ['game', 'gaming', 'xbox', 'playstation', 'video game'],
    '🎬': ['movie', 'movies', 'film', 'cinema', 'theater'],
    '🎵': ['music', 'song', 'concert', 'spotify'],
    '⚽': ['soccer', 'football', 'sport', 'game'],
    '🏀': ['basketball', 'sport', 'game', 'nba'],
    '🎸': ['guitar', 'music', 'concert', 'band'],
    '🎤': ['karaoke', 'singing', 'music', 'concert'],
    '✈️': ['flight', 'airport', 'travel', 'trip', 'vacation'],
    '🚗': ['car', 'drive', 'uber', 'lyft', 'ride'],
    '🚕': ['taxi', 'cab', 'uber', 'lyft', 'ride'],
    '🏠': ['home', 'house', 'rent', 'mortgage'],
    '🏨': ['hotel', 'stay', 'travel', 'vacation'],
    '⛽': ['gas', 'fuel', 'gasoline', 'petrol'],
    '🚇': ['subway', 'metro', 'train', 'transit'],
    '🚲': ['bike', 'bicycle', 'cycling', 'ride'],
    '💰': ['money', 'cash', 'payment', 'pay'],
    '💵': ['dollar', 'money', 'cash', 'bill'],
    '💳': ['card', 'credit', 'payment', 'pay'],
    '🛒': ['groceries', 'shopping', 'grocery', 'store', 'supermarket'],
    '🎫': ['ticket', 'tickets', 'concert', 'event', 'show'],
    '🏪': ['store', 'shop', 'shopping', 'convenience'],
    '❤️': ['love', 'thanks', 'thank you', 'heart'],
    '😂': ['funny', 'lol', 'haha', 'laugh'],
    '😊': ['happy', 'smile', 'thanks'],
    '🙏': ['thanks', 'thank you', 'please', 'grateful'],
    '👍': ['good', 'yes', 'ok', 'thanks', 'great'],
    '💯': ['perfect', '100', 'great', 'excellent'],
    '🔥': ['fire', 'hot', 'lit', 'awesome'],
    '✨': ['sparkle', 'magic', 'special', 'awesome'],
  },
  es: {
    '🍕': ['pizza', 'comida', 'cena', 'almuerzo'],
    '🍔': [
      'hamburguesa',
      'comida',
      'cena',
      'almuerzo',
      'mcdonalds',
      'comida rápida',
    ],
    '🌮': ['taco', 'comida', 'cena', 'almuerzo', 'mexicana'],
    '🍜': ['ramen', 'fideos', 'comida', 'cena', 'almuerzo', 'sopa'],
    '🍣': ['sushi', 'comida', 'cena', 'almuerzo', 'japonés'],
    '🍺': ['cerveza', 'bebida', 'bar', 'alcohol'],
    '🍻': ['cervezas', 'bebidas', 'bar', 'salud', 'alcohol'],
    '☕': ['café', 'cafetería', 'starbucks', 'bebida', 'desayuno'],
    '🍷': ['vino', 'bebida', 'alcohol', 'cena'],
    '🥂': ['champán', 'brindis', 'celebración', 'alcohol'],
    '🎉': ['fiesta', 'celebrar', 'cumpleaños', 'celebración'],
    '🎂': ['pastel', 'cumpleaños', 'postre', 'celebración'],
    '🎁': ['regalo', 'presente', 'cumpleaños', 'celebración'],
    '🎮': ['juego', 'gaming', 'xbox', 'playstation', 'videojuego'],
    '🎬': ['película', 'cine', 'film', 'teatro'],
    '🎵': ['música', 'canción', 'concierto', 'spotify'],
    '⚽': ['fútbol', 'deporte', 'partido'],
    '🏀': ['baloncesto', 'deporte', 'nba', 'partido'],
    '🎸': ['guitarra', 'música', 'concierto', 'banda'],
    '🎤': ['karaoke', 'cantar', 'música', 'concierto'],
    '✈️': ['vuelo', 'aeropuerto', 'viaje', 'vacaciones'],
    '🚗': ['auto', 'coche', 'conducir', 'uber', 'viaje'],
    '🚕': ['taxi', 'uber', 'viaje'],
    '🏠': ['casa', 'hogar', 'renta', 'alquiler'],
    '🏨': ['hotel', 'estancia', 'viaje', 'vacaciones'],
    '⛽': ['gasolina', 'combustible'],
    '🚇': ['metro', 'subte', 'tren', 'transporte'],
    '🚲': ['bicicleta', 'bici', 'ciclismo', 'viaje'],
    '💰': ['dinero', 'efectivo', 'pago', 'pagar'],
    '💵': ['dólar', 'dinero', 'efectivo', 'billete'],
    '💳': ['tarjeta', 'crédito', 'pago'],
    '🛒': ['compras', 'supermercado', 'tienda'],
    '🎫': ['ticket', 'entrada', 'concierto', 'evento'],
    '🏪': ['tienda', 'comercio', 'supermercado pequeño'],
    '❤️': ['amor', 'gracias', 'corazón'],
    '😂': ['gracioso', 'risa', 'jajaja'],
    '😊': ['feliz', 'sonrisa', 'gracias'],
    '🙏': ['gracias', 'por favor', 'agradecido'],
    '👍': ['bien', 'sí', 'ok', 'gracias', 'genial'],
    '💯': ['perfecto', 'excelente', '100'],
    '🔥': ['fuego', 'caliente', 'genial'],
    '✨': ['brillo', 'magia', 'especial', 'genial'],
  },
  it: {
    '🍕': ['pizza', 'cibo', 'cena', 'pranzo'],
    '🍔': [
      'burger',
      'hamburger',
      'cibo',
      'cena',
      'pranzo',
      'mcdonalds',
      'fast food',
    ],
    '🌮': ['taco', 'cibo', 'cena', 'pranzo', 'messicano'],
    '🍜': ['ramen', 'noodles', 'cibo', 'cena', 'pranzo', 'zuppa'],
    '🍣': ['sushi', 'cibo', 'cena', 'pranzo', 'giapponese'],
    '🍺': ['birra', 'bevanda', 'bar', 'alcol'],
    '🍻': ['birre', 'bevande', 'brindisi', 'alcol'],
    '☕': ['caffè', 'bar', 'starbucks', 'bevanda', 'colazione'],
    '🍷': ['vino', 'bevanda', 'alcol', 'cena'],
    '🥂': ['champagne', 'brindisi', 'celebrare', 'alcol'],
    '🎉': ['festa', 'celebrare', 'compleanno'],
    '🎂': ['torta', 'compleanno', 'dessert'],
    '🎁': ['regalo', 'presente', 'compleanno'],
    '🎮': ['gioco', 'gaming', 'xbox', 'playstation', 'videogioco'],
    '🎬': ['film', 'cinema', 'teatro'],
    '🎵': ['musica', 'canzone', 'concerto', 'spotify'],
    '⚽': ['calcio', 'sport', 'partita'],
    '🏀': ['basket', 'sport', 'nba'],
    '🎸': ['chitarra', 'musica', 'concerto', 'band'],
    '🎤': ['karaoke', 'cantare', 'musica'],
    '✈️': ['volo', 'aeroporto', 'viaggio', 'vacanza'],
    '🚗': ['auto', 'macchina', 'guidare', 'uber'],
    '🚕': ['taxi', 'uber', 'corsa'],
    '🏠': ['casa', 'abitazione', 'affitto', 'mutuo'],
    '🏨': ['hotel', 'soggiorno', 'viaggio'],
    '⛽': ['benzina', 'carburante'],
    '🚇': ['metro', 'sottopassaggio', 'treno', 'trasporto'],
    '🚲': ['bici', 'bicicletta', 'ciclismo'],
    '💰': ['soldi', 'contanti', 'pagamento'],
    '💵': ['dollaro', 'soldi', 'contanti'],
    '💳': ['carta', 'credito', 'pagamento'],
    '🛒': ['spesa', 'supermercato', 'negozio'],
    '🎫': ['biglietto', 'evento', 'concerto'],
    '🏪': ['negozio', 'minimarket'],
    '❤️': ['amore', 'grazie', 'cuore'],
    '😂': ['divertente', 'risata', 'ahah'],
    '😊': ['felice', 'sorriso', 'grazie'],
    '🙏': ['grazie', 'per favore', 'grato'],
    '👍': ['bene', 'ok', 'sì', 'grazie'],
    '💯': ['perfetto', 'eccellente'],
    '🔥': ['fuoco', 'caldo', 'fantastico'],
    '✨': ['brillare', 'magia', 'speciale'],
  },
  'pt-BR': {
    '🍕': ['pizza', 'comida', 'jantar', 'almoço'],
    '🍔': [
      'hambúrguer',
      'comida',
      'jantar',
      'almoço',
      'mcdonalds',
      'fast food',
    ],
    '🌮': ['taco', 'comida', 'jantar', 'almoço', 'mexicano'],
    '🍜': ['lamen', 'macarrão', 'comida', 'jantar', 'almoço', 'sopa'],
    '🍣': ['sushi', 'comida', 'jantar', 'almoço', 'japonês'],
    '🍺': ['cerveja', 'bebida', 'bar', 'álcool'],
    '🍻': ['cervejas', 'brinde', 'bebidas', 'álcool'],
    '☕': ['café', 'cafeteria', 'starbucks', 'bebida', 'café da manhã'],
    '🍷': ['vinho', 'bebida', 'álcool', 'jantar'],
    '🥂': ['champanhe', 'brinde', 'celebrar', 'álcool'],
    '🎉': ['festa', 'celebração', 'aniversário'],
    '🎂': ['bolo', 'aniversário', 'sobremesa'],
    '🎁': ['presente', 'gift', 'aniversário'],
    '🎮': ['jogo', 'gaming', 'xbox', 'playstation', 'videogame'],
    '🎬': ['filme', 'cinema', 'teatro'],
    '🎵': ['música', 'canção', 'show', 'spotify'],
    '⚽': ['futebol', 'esporte', 'jogo'],
    '🏀': ['basquete', 'esporte', 'nba'],
    '🎸': ['guitarra', 'música', 'show', 'banda'],
    '🎤': ['karaokê', 'cantar', 'música'],
    '✈️': ['voo', 'aeroporto', 'viagem', 'férias'],
    '🚗': ['carro', 'dirigir', 'uber'],
    '🚕': ['táxi', 'uber', 'corrida'],
    '🏠': ['casa', 'lar', 'aluguel'],
    '🏨': ['hotel', 'hospedagem', 'viagem'],
    '⛽': ['gasolina', 'combustível'],
    '🚇': ['metrô', 'trem', 'transporte'],
    '🚲': ['bicicleta', 'bike', 'ciclismo'],
    '💰': ['dinheiro', 'pagamento', 'pagar'],
    '💵': ['dólar', 'dinheiro', 'nota'],
    '💳': ['cartão', 'crédito', 'pagamento'],
    '🛒': ['mercado', 'compras', 'supermercado'],
    '🎫': ['ingresso', 'evento', 'show'],
    '🏪': ['loja', 'mercadinho', 'conveniência'],
    '❤️': ['amor', 'obrigado', 'coração'],
    '😂': ['engraçado', 'haha', 'risada'],
    '😊': ['feliz', 'sorriso', 'obrigado'],
    '🙏': ['obrigado', 'por favor', 'gratidão'],
    '👍': ['bom', 'ok', 'sim', 'obrigado'],
    '💯': ['perfeito', 'excelente'],
    '🔥': ['fogo', 'quente', 'incrível'],
    '✨': ['brilho', 'mágico', 'especial'],
  },
  'de-DE': {
    '🍕': ['pizza', 'essen', 'abendessen', 'mittagessen'],
    '🍔': [
      'burger',
      'essen',
      'abendessen',
      'mittagessen',
      'mcdonalds',
      'fast food',
    ],
    '🌮': ['taco', 'essen', 'abendessen', 'mittagessen', 'mexikanisch'],
    '🍜': ['ramen', 'nudeln', 'essen', 'suppe'],
    '🍣': ['sushi', 'essen', 'japanisch'],
    '🍺': ['bier', 'getränk', 'bar', 'alkohol'],
    '🍻': ['biere', 'anstoßen', 'getränke', 'alkohol'],
    '☕': ['kaffee', 'café', 'starbucks', 'getränk', 'frühstück'],
    '🍷': ['wein', 'getränk', 'alkohol'],
    '🥂': ['sekt', 'champagner', 'anstoßen', ' feiern'],
    '🎉': ['party', 'feiern', 'geburtstag'],
    '🎂': ['kuchen', 'geburtstag', 'dessert'],
    '🎁': ['geschenk', 'präsent', 'geburtstag'],
    '🎮': ['spiel', 'gaming', 'xbox', 'playstation', 'videospiel'],
    '🎬': ['film', 'kino', 'theater'],
    '🎵': ['musik', 'lied', 'konzert', 'spotify'],
    '⚽': ['fußball', 'sport', 'spiel'],
    '🏀': ['basketball', 'sport', 'nba'],
    '🎸': ['gitarre', 'musik', 'konzert', 'band'],
    '🎤': ['karaoke', 'singen', 'musik'],
    '✈️': ['flug', 'reise', 'urlaub', 'flughafen'],
    '🚗': ['auto', 'fahren', 'uber', 'fahrt'],
    '🚕': ['taxi', 'fahrt'],
    '🏠': ['haus', 'heim', 'miete'],
    '🏨': ['hotel', 'aufenthalt', 'reise'],
    '⛽': ['benzin', 'kraftstoff'],
    '🚇': ['u-bahn', 'bahn', 'zug', 'verkehr'],
    '🚲': ['fahrrad', 'radfahren'],
    '💰': ['geld', 'zahlung'],
    '💵': ['dollar', 'geld', 'schein'],
    '💳': ['karte', 'kreditkarte', 'zahlung'],
    '🛒': ['einkauf', 'supermarkt', 'laden'],
    '🎫': ['ticket', 'eintritt', 'event'],
    '🏪': ['laden', 'geschäft', 'kiosk'],
    '❤️': ['liebe', 'danke', 'herz'],
    '😂': ['lustig', 'lol', 'lachen'],
    '😊': ['glücklich', 'lächeln', 'danke'],
    '🙏': ['danke', 'bitte', 'dankbar'],
    '👍': ['gut', 'ok', 'ja', 'danke'],
    '💯': ['perfekt', 'super'],
    '🔥': ['feuer', 'heiß', 'cool'],
    '✨': ['glitzer', 'magisch', 'besonders'],
  },
};

const ALL_EMOJIS = [
  '🍕',
  '🍔',
  '☕',
  '🍺',
  '🚗',
  '⛽',
  '🏠',
  '💰',
  '🎉',
  '❤️',
  '🌮',
  '🍜',
  '🍣',
  '🍻',
  '🍷',
  '🥂',
  '🎂',
  '🎁',
  '🎮',
  '🎬',
  '🎵',
  '⚽',
  '🏀',
  '🎸',
  '🎤',
  '✈️',
  '🚕',
  '🏨',
  '🚇',
  '🚲',
  '💵',
  '💳',
  '🛒',
  '🎫',
  '🏪',
  '😂',
  '😊',
  '🙏',
  '👍',
  '💯',
  '🔥',
  '✨',
];

// Default emoji order (most common first)
const DEFAULT_EMOJI_ORDER = ['💵', '🏠', '⛽', '🍕', '☕', '🎁', '🎉', '🎫'];

const EmojiQuickBar = ({ description = '', onEmojiSelect }) => {
  const { backgroundOffset } = GetThemeColors();

  const defalutItems = useMemo(() => {
    return DEFAULT_EMOJI_ORDER.map(item => ({
      emoji: item,
      shouldReplace: false,
      score: 0,
    }));
  }, []);

  const sortedEmojis = useMemo(() => {
    const splitString = description.split(' ');
    const currentWord = splitString[splitString.length - 1] || '';
    if (!currentWord.trim()) {
      return defalutItems;
    }

    const lowerDescription = currentWord.toLowerCase();
    const scored = ALL_EMOJIS.map(emoji => {
      const keywords = EMOJI_KEYWORDS[i18next.language][emoji] || [];

      const shouldReplace = keywords[0]
        ?.toLowerCase()
        .startsWith(lowerDescription);
      const score = keywords.reduce((count, keyword) => {
        return count + (keyword.includes(lowerDescription) ? 1 : 0);
      }, 0);
      if (score === 0) return false;
      return { emoji, score, shouldReplace };
    }).filter(Boolean);

    if (!scored.length) return defalutItems;

    return scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return ALL_EMOJIS.indexOf(a.emoji) - ALL_EMOJIS.indexOf(b.emoji);
      })
      .map(item => item);
  }, [description, defalutItems]);

  const createDescription = useCallback(
    emoji => {
      let newDescription = '';
      if (emoji.shouldReplace) {
        let prevDescription = description.split(' ');
        prevDescription.pop();
        newDescription = prevDescription.join(' ') + emoji.emoji;
      } else {
        newDescription = description + ' ' + emoji.emoji;
      }

      onEmojiSelect(newDescription);
    },
    [description, onEmojiSelect],
  );

  return (
    <View style={[styles.emojiBar, { backgroundColor: backgroundOffset }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.emojiScrollContent}
        keyboardShouldPersistTaps="always"
      >
        {sortedEmojis.map((emoji, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => createDescription(emoji)}
            style={styles.emojiButton}
          >
            <ThemeText styles={styles.emoji} content={emoji.emoji} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emojiBar: {
    height: 50,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  emojiScrollContent: {
    alignItems: 'center',
  },
  emojiButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
});

export default EmojiQuickBar;
