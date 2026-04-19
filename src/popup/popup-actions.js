window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || String(event.reason || "");
  if (/Could not create an options page|Extension context invalidated/i.test(message)) {
    event.preventDefault();
    setStatus("扩展刚刷新过，请刷新当前聊天页后再试。");
  }
});

document.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    await sendActionToCurrentTab(actionButton.dataset.action);
    return;
  }

  if (event.target.closest("#open-options")) {
    await openSettings();
  }
});

async function sendActionToCurrentTab(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("没有找到当前页面。");
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      source: "chattrail-popup",
      action
    });

    setStatus(response?.ok ? "已发送到当前页面。" : (response?.error || "当前页面没有响应。"));
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      setStatus("扩展刚刷新过，请刷新当前聊天页。");
      return;
    }

    setStatus("请先打开 ChatGPT 或豆包页面，并刷新扩展。");
  }
}

async function openSettings() {
  const url = chrome.runtime.getURL("src/options/options.html");

  try {
    await chrome.tabs.create({ url });
    window.close();
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      setStatus("扩展刚刷新过，请重新打开弹窗。");
      return;
    }

    setStatus("设置页打开失败，请在扩展详情页里打开。");
  }
}

function setStatus(message) {
  document.querySelector("#status").textContent = message;
}

function isExtensionContextInvalidated(error) {
  return /Extension context invalidated/i.test(error?.message || String(error || ""));
}
