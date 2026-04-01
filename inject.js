function sendWocaData() {
  const words = window.$locWords || (typeof $locWords !== 'undefined' ? $locWords : null);
  if (words) {
    window.postMessage({ type: "WOCABEE_DATA", words: words }, "*");
    console.log("WocaBot: Data sent.");
  } else {
    setTimeout(sendWocaData, 500);
  }
}
sendWocaData();