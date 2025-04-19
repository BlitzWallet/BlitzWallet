import {useEffect, useMemo, useRef, useState} from 'react';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import {applyErrorAnimationTheme} from '../../../../functions/lottieViewColorTransformer';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import LottieView from 'lottie-react-native';
import {useWindowDimensions} from 'react-native';
import fetchBackend from '../../../../../db/handleBackend';
import {useKeysContext} from '../../../../../context-store/keys';
import {setLocalStorageItem} from '../../../../functions';
const errorTxAnimation = require('../../../../assets/errorTxAnimation.json');
export default function NoDataView() {
  const [isLoading, setIsLoading] = useState(false);
  const {theme, darkModeType} = useGlobalThemeContext();
  const {publicKey, contactsPrivateKey} = useKeysContext();
  const {toggleMasterInfoObject} = useGlobalContextProvider();
  const animationRef = useRef(null);

  const errorAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      errorTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  const handleSearch = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetchBackend(
        'getTotalUserCount',
        {data: publicKey},
        contactsPrivateKey,
        publicKey,
      );

      toggleMasterInfoObject({exploreData: response});

      setLocalStorageItem(
        'savedExploreData',
        JSON.stringify({lastUpdated: new Date().getTime(), data: response}),
      );
    } catch (err) {
      console.log('handling explore users search err', err);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <GlobalThemeView
      styles={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 0,
        paddingTop: 0,
      }}
      useStandardWidth={true}>
      <LottieView
        ref={animationRef}
        source={errorAnimation}
        loop={false}
        style={{
          width: useWindowDimensions().width / 1.5,
          height: useWindowDimensions().width / 1.5,
          marginTop: 'auto',
        }}
      />
      <ThemeText
        styles={{marginBottom: 'auto'}}
        content={'We were unable to retrive Blitz user count.'}
      />
      <CustomButton
        actionFunction={handleSearch}
        useLoading={isLoading}
        buttonStyles={{marginTop: 'auto'}}
        textContent={'Try again'}
      />
    </GlobalThemeView>
  );
}
