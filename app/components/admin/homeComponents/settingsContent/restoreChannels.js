// import {StyleSheet, View} from 'react-native';
// import {ThemeText} from '../../../../functions/CustomElements';
// import {useEffect, useRef, useState} from 'react';
// import {useNavigation} from '@react-navigation/native';
// import {staticBackup} from '@breeztech/react-native-breez-sdk';
// import CustomButton from '../../../../functions/CustomElements/button';
// import {BREEZ_WORKING_DIR_KEY, CENTER} from '../../../../constants';
// import {getLocalStorageItem} from '../../../../functions';
// import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
// import {useLightningEvent} from '../../../../../context-store/lightningEventContext';
// import connectToLightningNode from '../../../../functions/connectToLightning';
// import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
// import writeAndShareFileToFilesystem from '../../../../functions/writeFileToFilesystem';

// export default function RestoreChannel() {
//   const [SCBfile, setSCBfile] = useState(null);
//   const [failedToConnect, setFailedToConnect] = useState(false);
//   const navigate = useNavigation();
//   const {onLightningBreezEvent} = useLightningEvent();
//   const didRunConnection = useRef(false);

//   useEffect(() => {
//     async function getStaticBackup() {
//       try {
//         const workingDirPath = await getLocalStorageItem(BREEZ_WORKING_DIR_KEY);

//         const backupData = await staticBackup({
//           workingDir: workingDirPath,
//         });

//         setSCBfile(backupData);
//       } catch (err) {
//         if (didRunConnection.current) return;
//         didRunConnection.current = true;
//         const lightningSession = await connectToLightningNode(
//           onLightningBreezEvent,
//         );
//         if (lightningSession?.isConnected) {
//           getStaticBackup();
//         } else setFailedToConnect(true);
//         console.log(err);
//         navigate.navigate('ErrorScreen', {
//           errorMessage: 'Not able to retrive SCB file',
//         });
//       }
//     }
//     getStaticBackup();
//   }, []);
//   return (
//     <View style={{flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER}}>
//       {SCBfile ? (
//         <>
//           <ThemeText
//             styles={styles.descriptionText}
//             content={
//               'This will generate a Static Channel Backup (SCB) file to be used as a last resort to recover funds in case the Greenlight node becomes inaccessible.'
//             }
//           />
//           <ThemeText
//             styles={styles.descriptionText}
//             content={
//               'To recover the funds, create a new core lighting node with its HSM secret using your backup wallet phrase. Then, trigger a channel recovery through the recoverchannel method provided by core lightning'
//             }
//           />

//           <CustomButton
//             actionFunction={() => {
//               downloadBackupFile(SCBfile, navigate);
//             }}
//             buttonStyles={{...CENTER, marginTop: 30}}
//             textContent={'Export'}
//           />
//         </>
//       ) : (
//         <FullLoadingScreen
//           showLoadingIcon={!failedToConnect}
//           text={'Getting Channel'}
//         />
//       )}
//     </View>
//   );
// }

// async function downloadBackupFile(file, navigate) {
//   const content = JSON.stringify(file);

//   const fileName = `blitzSCBFile.json`;
//   await writeAndShareFileToFilesystem(
//     content,
//     fileName,
//     'application/json',
//     navigate,
//   );
// }

// const styles = StyleSheet.create({
//   descriptionText: {marginTop: 20, textAlign: 'center'},
// });
