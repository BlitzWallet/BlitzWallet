import { ICONS } from '../../../../constants';

const APPLIST = [
  {
    name: 'apps.appList.AI',
    svgName: 'AiAppIcon',
    description: 'apps.appList.AIDescription',
    pageName: 'AI',
  },
  {
    name: 'apps.appList.SMS',
    iconLight: ICONS.messagesLight,
    iconDark: ICONS.messagesDark,
    description: 'apps.appList.SMSDescription',
    pageName: 'sms4sats',
  },
  // {
  //   name: 'apps.appList.VPN',
  //   svgName: 'shield',
  //   description: 'apps.appList.VPNDescription',
  //   pageName: 'lnvpn',
  // },
  {
    name: 'apps.appList.onlineListings',
    svgName: 'globeIcon',
    description: 'apps.appList.onlineListingsDescription',
    pageName: 'onlineListings',
  },
  {
    name: 'apps.appList.Soon',
    svgName: 'clock',
    description: 'apps.appList.SoonDescription',
    pageName: 'soon',
  },
];

export { APPLIST };
