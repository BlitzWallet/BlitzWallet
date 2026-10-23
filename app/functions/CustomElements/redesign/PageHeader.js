import { StyleSheet, View } from 'react-native';
import PageTitle from './PageTitle';
import ThemeText from '../textTheme';
import { FONT, SIZES } from '../../../constants';

export default function PageHeader({
  title,
  titleStyles,
  sub,
  subStyles,
  showSub = true,
}) {
  return (
    <View>
      <PageTitle
        text={title}
        titleStyles={{ ...styles.title, ...titleStyles }}
      />
      {showSub && (
        <ThemeText content={sub} styles={[styles.subtitle, subStyles]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Medium,
    includeFontPadding: false,
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
});
