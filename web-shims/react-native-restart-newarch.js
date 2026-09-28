// Web shim for react-native-restart-newarch: a full reload is the browser
// equivalent of restarting the RN root. Callers use RNRestart.restart().
function restart() {
  if (typeof window !== 'undefined') window.location.reload();
}
export default { restart, Restart: restart };
