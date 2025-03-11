import {
  Animated,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, ICONS, SIZES} from '../../constants';
import {ThemeText} from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {backArrow} from '../../constants/styles';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';

export default function SkipCreateAccountPathMessage() {
  const BlurViewAnimation = useRef(new Animated.Value(0)).current;
  const isInitialLoad = useRef(true);
  const navigate = useNavigation();
  const [goBack, setGoGack] = useState(false);
  const goToPinRef = useRef(false);
  const {t} = useTranslation();

  const handleBackPressFunction = () => {
    setGoGack(true);
  };
  useHandleBackPressNew(handleBackPressFunction);

  useEffect(() => {
    if (isInitialLoad.current) {
      Animated.timing(BlurViewAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      isInitialLoad.current = false;
    }
    if (goBack) {
      Animated.timing(BlurViewAnimation, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        navigate.goBack();
        if (goToPinRef.current)
          navigate.navigate('PinSetup', {isInitialLoad: true});
      });
    }
  }, [goBack]);

  return (
    <Animated.View style={[styles.absolute, {opacity: BlurViewAnimation}]}>
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <TouchableOpacity
            onPress={() => setGoGack(true)}
            style={{marginLeft: 'auto', marginBottom: 10}}>
            <Image style={[backArrow]} source={ICONS.xSmallIcon} />
          </TouchableOpacity>

          <ThemeText
            styles={{marginBottom: 20, textAlign: 'center'}}
            content={t('createAccount.skipMessage.header')}
          />
          <ThemeText
            styles={{marginBottom: 30, textAlign: 'center'}}
            content={t('createAccount.skipMessage.subHeader')}
          />
          <CustomButton
            buttonStyles={{
              width: 'auto',
              backgroundColor: COLORS.primary,
            }}
            textStyles={{
              color: COLORS.darkModeText,
            }}
            textContent={t('createAccount.skipMessage.btn')}
            actionFunction={() => {
              setGoGack(true);
              goToPinRef.current = true;
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  absolute: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentContainer: {
    width: '70%',
    backgroundColor: COLORS.darkModeText,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
});
