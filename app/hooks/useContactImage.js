// import {useEffect, useState} from 'react';
// import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../constants';
// import {getAllLocalKeys, getMultipleItems} from '../functions/localStorage';

// export function useContactImage(uuid) {
//   const [uri, setUri] = useState({});

//   useEffect(() => {
//     async function load() {
//       const keys = await getAllLocalKeys();
//       const imgKeys = keys.filter(k =>
//         k.startsWith(BLITZ_PROFILE_IMG_STORAGE_REF),
//       );
//       const stores = await getMultipleItems(imgKeys);
//       const initialCache = {};
//       stores.forEach(([key, value]) => {
//         if (value) {
//           const uuid = key.replace(BLITZ_PROFILE_IMG_STORAGE_REF + '/', '');
//           const parsed = JSON.parse(value);
//           initialCache[uuid] = parsed;
//         }
//       });
//       if (initialCache[uuid]?.localUri) {
//         setUri(initialCache[uuid]);
//       }
//     }
//     load();
//   }, [uuid]);

//   return uri;
// }
