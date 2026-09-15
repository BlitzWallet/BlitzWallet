import * as ImageManipulator from 'expo-image-manipulator';
import { deleteAsync } from 'expo-file-system/legacy';
import { loadImage } from 'react-native-nitro-image';
import { createBarcodeScanner } from 'react-native-vision-camera-barcode-scanner';

export async function detectQRCode(uri) {
  let temporaryImageUri;
  let image;
  const scanner = createBarcodeScanner({ barcodeFormats: ['qr-code'] });

  try {
    const resized = ImageManipulator.ImageManipulator.manipulate(uri).resize({
      width: 400,
    });

    const rendered = await resized.renderAsync();
    const savedImage = await rendered.saveAsync({
      compress: 0.5,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    temporaryImageUri = savedImage.uri;

    image = await loadImage({ filePath: temporaryImageUri });
    const barcodes = await scanner.scanCodesInImageAsync(image);

    return {
      type: 'QRCode',
      values: barcodes.map(b => b.rawValue).filter(Boolean),
    };
  } catch (error) {
    console.error('QR detection failed:', error);
    return null;
  } finally {
    image?.dispose();
    scanner.dispose();
    if (temporaryImageUri) {
      try {
        await deleteAsync(temporaryImageUri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Failed to delete temporary QR scan image:', cleanupError);
      }
    }
  }
}
