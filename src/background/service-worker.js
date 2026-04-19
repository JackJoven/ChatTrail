chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== "chattrail" || message.action !== "open-options") {
    return false;
  }

  chrome.tabs.create({
    url: chrome.runtime.getURL("src/options/options.html")
  }).then(() => {
    sendResponse({ ok: true });
  }).catch((error) => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});
