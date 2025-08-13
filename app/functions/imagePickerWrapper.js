import {launchImageLibrary} from 'react-native-image-picker';
const options = {
  mediaType: 'photo',
  quality: 0.8,
  selectionLimit: 1,
};
export async function getImageFromLibrary() {
  try {
    const result = await launchImageLibrary(options);
    if (result.didCancel) return {didRun: false, error: ''};
    const imgURL = result.assets[0];
    console.log(imgURL);

    return {didRun: true, imgURL: imgURL};
  } catch (err) {
    console.log('error getting image from library', err);
    return {
      didRun: true,
      error: 'errormessages.retriveingPhotoesError',
    };
  }
}
