// import {StyleSheet, Text, TouchableOpacity} from 'react-native';
// import {BTN, COLORS, FONT, SIZES} from '../../constants';

// export default function Continue_BTN(props) {
//   let style;
//   let canContinue;
//   if (props.for === 'disclaimer') {
//     canContinue =
//       props?.continue?.filter(state => state.isEnabled).length === 2;

//     if (canContinue) style = styles.container_withClick;
//     else style = styles.container_withoutClick;
//   } else {
//     style = styles.container_withClick;
//   }
//   function canPress() {
//     if (props.for === 'disclaimer') {
//       if (canContinue) {
//         return props.navigation(props.destination);
//       } else {
//         return '';
//       }
//     } else {
//       return props.navigation(props.destination);
//     }
//   }

//   return (
//     <TouchableOpacity
//       style={[BTN, style, {marginTop: 'auto'}]}
//       onPress={canPress}>
//       <Text style={styles.text}>{props.text}</Text>
//     </TouchableOpacity>
//   );
// }

// const styles = StyleSheet.create({
//   container_withClick: {
//     width: '90%',
//     height: 45,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: COLORS.primary,

//     marginTop: 'auto',
//     opacity: 1,
//   },
//   container_withoutClick: {
//     width: '90%',
//     height: 45,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: COLORS.primary,

//     marginTop: 'auto',
//     opacity: 0.2,
//   },
//   text: {
//     color: COLORS.white,
//     fontSize: SIZES.large,
//     fontFamily: FONT.Other_Regular,
//   },
// });
