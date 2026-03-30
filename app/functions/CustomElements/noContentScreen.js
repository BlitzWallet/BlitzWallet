import { StyleSheet, View } from 'react-native';
import ThemeIcon from './themeIcon';
import { CENTER, ICONS } from '../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../constants/theme';
import ThemeText from './textTheme';
import ThemeImage from './themeImage';
import CustomButton from './button';

export default function NoContentSceen({
  iconName = '',
  titleText = '',
  subTitleText = '',
  containerStyles = {},
  showButton = false,
  buttonText = '',
  buttonFunction = () => {},
}) {
  return (
    <View style={[styles.container, containerStyles]}>
      {iconName === 'Receipt' ? (
        <ThemeImage
          lightModeIcon={ICONS.receiptIcon}
          darkModeIcon={ICONS.receiptIcon}
          lightsOutIcon={ICONS.receiptWhite}
        />
      ) : (
        <ThemeIcon iconName={iconName} />
      )}
      <ThemeText styles={styles.emptyTitle} content={titleText} />
      <ThemeText
        styles={[styles.emptySubtext, { marginBottom: showButton ? 25 : 0 }]}
        content={subTitleText}
      />
      {showButton && (
        <CustomButton
          buttonStyles={styles.buttonStyles}
          actionFunction={buttonFunction}
          textContent={buttonText}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  emptyTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
  buttonStyles: {
    width: '100%',
  },
});
