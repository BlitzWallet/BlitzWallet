// Web shim for react-native-clusterer (a native JSI reimplementation of
// supercluster). On web we swap in the pure-JS `supercluster` package — same
// API surface used by app/functions/btcMap/mapClustering.js: new Supercluster(),
// .load(), .getClusters(), .getClusterExpansionZoom().
import Supercluster from 'supercluster';

export default Supercluster;
