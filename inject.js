function sendWocaData() {
  if (typeof $locWords !== 'undefined') {
    window.postMessage({ type: "WOCABEE_DATA", words: $locWords }, "*");
  } else {
    setTimeout(sendWocaData, 500);
  }
}
sendWocaData();