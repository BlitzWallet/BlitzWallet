import { ScrollView } from 'react-native';

// iOS bounces ScrollViews (vertical and horizontal) even when their content fits, so the page
// looks scrollable when it isn't. Only bounce when content overflows, except
// with a refreshControl, where pull-to-refresh needs the bounce on short content.
// React 19 passes `ref` as a regular prop, so it reaches ScrollView via the spread.
export default function CustomScrollView(props) {
  return (
    <ScrollView
      alwaysBounceVertical={!!props.refreshControl}
      alwaysBounceHorizontal={false}
      {...props}
    />
  );
}
