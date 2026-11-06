import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { GlobalThemeView } from '../../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { CENTER } from '../../../../../constants/styles';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import StaffSignCard, {
  signCardStyle,
} from './internalComponents/staffSignCard';
import { useImageCache } from '../../../../../../context-store/imageCache';
import { useMemo, useRef } from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import { shareMessage } from '../../../../../functions/handleShare';

// Web-only variant of posInstructionsPath.js. Metro resolves this `.web.js`
// over the native file on the web platform (same mechanism as
// webViewContext.web.js / sliderButton.web.js), so react-native-view-shot +
// react-native-pdf-from-image + expo-file-system copy/share (all broken in the
// browser) never load. Both files render the shared StaffSignCard; only the
// "Print" action differs: capture the card DOM to a PNG and hand it to the OS
// share sheet via the Web Share API.
//
// ponytail: DOM->PNG via SVG <foreignObject> (no html2canvas dep). Known
// ceilings: (1) custom @font-face may fall back to a system font in the raster
// pass; (2) the brand logo is a cross-origin Firebase URL — inlined best-effort
// and dropped from the image if CORS blocks the fetch (QR + text always render).
// Upgrade path: add html-to-image if fidelity ever matters.
async function inlineImages(node) {
  const imgs = [...node.querySelectorAll('img')];
  await Promise.all(
    imgs.map(async img => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const res = await fetch(src, { mode: 'cors' });
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute('src', dataUrl);
      } catch {
        img.remove();
      }
    }),
  );
}

function collectCss() {
  let css = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += rule.cssText + '\n';
    } catch {
      // Cross-origin sheet — cssRules access throws; skip it.
    }
  }
  return css;
}

async function nodeToPngBlob(node, scale = 2) {
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  const clone = node.cloneNode(true);
  await inlineImages(clone);

  const xhtml = 'http://www.w3.org/1999/xhtml';
  clone.setAttribute('xmlns', xhtml);
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">` +
    `<style>${collectCss()}</style>${serialized}` +
    `</foreignObject></svg>`;

  const img = new window.Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export default function POSInstructionsPath() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { cache } = useImageCache();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const posURL = `https://pay.blitzwalletapp.com/${masterInfoObject.posSettings.storeName}`;
  const cardRef = useRef(null);
  const didShare = useRef(null);

  const logoKey = masterInfoObject?.posSettings?.brandLogo;
  const cachedImageData = logoKey ? cache?.[logoKey] : null;

  const brandLogoUri = cachedImageData?.localUri || null;
  const brandLogoUpdated = cachedImageData?.updated || null;

  const brandLogoSource = useMemo(() => {
    if (!brandLogoUri) return null;

    if (brandLogoUpdated) {
      const version = new Date(brandLogoUpdated).getTime();
      if (!isNaN(version)) {
        return `${brandLogoUri}?v=${version}`;
      }
    }

    return brandLogoUri;
  }, [brandLogoUri, brandLogoUpdated]);

  const shareViewAsImage = async () => {
    try {
      if (didShare.current) return;
      didShare.current = true;
      const node = cardRef.current;
      if (!node) throw new Error('Card not mounted');

      const blob = await nodeToPngBlob(node);
      if (!blob) throw new Error('Capture produced no image');

      const fileName = `Blitz_${t(
        'settings.posPath.posInstructionsPath.title',
      )}_${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t('settings.posPath.posInstructionsPath.title'),
        });
        return;
      }

      // No Web Share (e.g. desktop) — fall back to a download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (error?.name === 'AbortError') return; // user dismissed the share sheet
      console.error('Error sharing POS image:', error);
      showToast({ type: 'error', title: t('errormessages.genericError') });
    } finally {
      didShare.current = false;
    }
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.posPath.posInstructionsPath.title')}
          right={
            <IconButton
              icon="Share2"
              iconSize={20}
              label={t('settings.posPath.posInstructionsPath.share')}
              onPress={() => shareMessage({ url: posURL })}
            />
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={signCardStyle} ref={cardRef}>
            <StaffSignCard
              posURL={posURL}
              logoSource={brandLogoSource}
              onCopyLink={() => copyToClipboard(posURL, showToast)}
            />
          </View>
        </CustomScrollView>
        <CustomButton
          actionFunction={shareViewAsImage}
          textContent={t('constants.print')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingBottom: 16 },
});
