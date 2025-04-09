import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS} from '../../constants';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import {SIZES} from '../../constants/theme';
import CustomButton from '../../functions/CustomElements/button';
import {G, Path, Svg} from 'react-native-svg';
import LoginNavbar from '../../components/login/navBar';
import {useTranslation} from 'react-i18next';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {crashlyticsLogReport} from '../../functions/crashlyticsLogs';

export default function DislaimerPage({navigation: {navigate}}) {
  const {t} = useTranslation();
  useHandleBackPressNew();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.contentContainer}>
        <LoginNavbar />
        <ThemeText
          styles={{
            fontSize: SIZES.xxLarge,
            fontWeight: '500',
            marginTop: 'auto',
            marginBottom: 15,
          }}
          content={t('createAccount.disclaimerPage.header')}
        />
        <ThemeText
          styles={{
            fontWeight: '500',
            width: '85%',
            textAlign: 'center',
            marginBottom: 10,
          }}
          content={`Blitz cannot access your funds or help recover them if lost. By continuing, you agree to Blitz Wallet's terms and conditions.`}
        />
        <Svg
          width="300"
          height="300"
          viewBox="50 50 630 630"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <G clip-path="url(#clip0_133_2700)">
            <Path
              d="M498.373 211.404L498.375 211.409C510.058 233.639 513.656 260.173 506.47 286.292C495.867 324.837 464.683 352.144 428.084 359.651L426.883 359.898L426.557 361.08L407.405 430.699L372.807 445.815L371.112 446.556L371.718 448.303L381.703 477.096L358.395 496.734L357.343 497.62L357.794 498.919L368.024 528.428L360.189 556.912L326.493 575.155L325.492 573.746L324.483 576.748L319.723 578.828L319.645 578.862L319.57 578.902L319.356 579.019L284.364 535.872L339.069 337.014L339.395 335.83L338.487 335.004C310.829 309.82 297.999 270.406 308.603 231.861C323.634 177.22 380.127 145.145 434.772 160.177C436.551 160.667 438.316 161.216 440.04 161.819C439.79 164.801 439.271 167.784 438.452 170.759C435.476 181.578 429.039 190.792 420.002 197.181C410.343 196.021 400.952 199.845 394.816 206.995C392.814 209.298 391.177 211.928 389.974 214.843C389.497 215.945 389.134 217.053 388.832 218.15C384.609 233.501 393.694 249.476 409.045 253.699C409.811 253.91 410.635 254.077 411.33 254.217L411.474 254.246L411.62 254.253C411.621 254.254 411.63 254.254 411.649 254.257C411.678 254.261 411.714 254.267 411.777 254.277C411.877 254.295 412.062 254.328 412.27 254.353C421.388 255.832 430.411 252.785 436.709 246.623C459.353 235.236 476.633 215.8 485.247 192.138C487.307 194.516 489.266 196.956 491.076 199.489C491.209 199.678 491.339 199.877 491.487 200.103L491.53 200.17C491.662 200.372 491.81 200.599 491.965 200.825L491.967 200.828C494.175 204.026 496.214 207.326 498.036 210.733C498.08 210.818 498.124 210.907 498.18 211.021L498.188 211.036C498.24 211.142 498.304 211.272 498.373 211.404ZM307.285 544.303L309.724 547.664L310.831 543.661L329.423 476.443L329.424 476.44L359.49 367.145L359.973 365.39L358.271 364.745C354.697 363.389 353.391 362.529 351.391 361.213C350.345 360.524 349.108 359.71 347.258 358.635L345.013 357.331L344.324 359.834L297.601 529.679L297.346 530.606L297.911 531.385L307.285 544.303Z"
              stroke={COLORS.lightModeText}
              strokeWidth="4"
            />
            <Path
              d="M352.123 150.541C350.273 151.468 348.452 152.439 346.663 153.452L346.655 153.456L346.648 153.46C319.788 168.951 298.77 194.537 289.917 226.72C278.64 267.712 289.265 310.75 317.69 341.647L317.404 342.689L317.257 342.635L317.241 342.693C316.162 342.326 315.092 341.934 314.011 341.513L312.866 341.066L311.95 341.887L275.955 374.147L275.953 374.149L260.133 388.373L224.265 382.598L222.44 382.305L222.004 384.101L215.072 412.616L186.01 416.355L184.644 416.531L184.321 417.87L177.261 447.129L156.065 466.118L111.54 462.729L105.643 409.623L217.624 309.142L217.625 309.141L253.615 276.877L254.528 276.059L254.213 274.874C244.971 240.063 255.074 201.465 283.71 175.784L283.712 175.782C303.231 158.239 327.826 149.932 352.123 150.541ZM352.123 150.541C352.194 150.506 352.265 150.47 352.336 150.434L352.168 150.417L355.833 148.7M313.285 343.376C314.428 343.822 315.562 344.237 316.71 344.624L260.76 390.499L277.29 375.637L313.285 343.376Z"
              stroke={COLORS.lightModeText}
              strokeWidth="4"
            />
            <Path
              d="M330.454 134.827C324.115 135.866 317.905 137.453 311.853 139.572C311.868 139.502 311.883 139.433 311.898 139.363C312.136 138.257 312.361 137.214 312.653 136.151C324.666 92.4817 369.968 66.6857 413.638 78.6989C451.754 89.1845 476.175 124.967 473.899 162.861C473.549 168.47 472.617 174.135 471.076 179.734C464.44 203.859 447.625 222.538 426.605 232.329L426.595 232.334C422.485 234.276 418.238 235.878 413.873 237.053C413.812 237.037 413.737 237.017 413.641 236.991C407.487 235.298 403.851 228.898 405.543 222.746C405.606 222.52 405.675 222.295 405.752 222.072C412.032 220.738 418.022 218.453 423.588 215.367C438.518 207.137 450.28 193.095 455.16 175.354C457.402 167.205 458.034 158.932 457.145 150.997C454.379 124.958 436.026 101.979 409.259 94.6156C376.354 85.5636 342.221 103.382 330.454 134.827Z"
              stroke={COLORS.lightModeText}
              strokeWidth="4"
            />
          </G>
        </Svg>
        <ThemeText
          styles={{
            width: '85%',
            fontStyle: 'italic',
            textAlign: 'center',
          }}
          content={t('createAccount.disclaimerPage.imgCaption')}
        />

        <CustomButton
          buttonStyles={{
            width: 145,
            backgroundColor: COLORS.primary,
            marginTop: 'auto',
          }}
          textStyles={{
            color: COLORS.darkModeText,
          }}
          textContent={t('constants.next')}
          actionFunction={() => navigate('GenerateKey')}
        />
        <TouchableOpacity
          onPress={() => {
            crashlyticsLogReport(
              'Navigating to custom webview from displaimer page',
            );
            navigate('CustomWebView', {
              webViewURL: 'https://blitz-wallet.com/pages/terms/',
            });
          }}
          style={{marginTop: 10, opacity: 0.8}}>
          <ThemeText content={'Terms and Conditions'} />
        </TouchableOpacity>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
});
