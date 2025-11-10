import * as ImagePicker from 'expo-image-picker';

export async function getImageFromLibrary() {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
      selectionLimit: 1,
    });

    if (result.canceled) return { didRun: false, error: '' };

    const imgURL = result.assets?.[0];

    return { didRun: true, imgURL };
  } catch (err) {
    console.log('error getting image from library', err);
    return {
      didRun: true,
      error: 'errormessages.retriveingPhotoesError',
    };
  }
}
