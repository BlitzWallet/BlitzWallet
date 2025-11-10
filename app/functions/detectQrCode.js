import * as ImageManipulator from 'expo-image-manipulator';
import RNQRGenerator from 'rn-qr-generator';

export async function detectQRCode(uri) {
  try {
    const resized = ImageManipulator.ImageManipulator.manipulate(uri).resize({
      width: 400,
    });

    const image = await resized.renderAsync();
    const savedImage = await image.saveAsync({
      compress: 0.5,
      format: ImageManipulator.SaveFormat.WEBP,
    });

    const response = await RNQRGenerator.detect({
      uri: savedImage.uri,
    });

    return response;
  } catch (error) {
    if (error.message.includes('OutOfMemoryError')) {
      console.warn('Image too large — could not scan QR. Try a smaller image.');
    } else {
      console.error('QR detection failed:', error);
    }
    return null;
  }
}
