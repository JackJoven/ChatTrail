(() => {
  "use strict";

  if (window.__CHATTRAIL_ENHANCEMENTS_LOADED__) {
    return;
  }
  window.__CHATTRAIL_ENHANCEMENTS_LOADED__ = true;

  const STORAGE_KEYS = {
    prompts: "chattrail.prompts",
    settings: "chattrail.settings"
  };
  const TOOLBAR_POSITION_KEY = "chattrail.toolbar.position";
  const TOOLBAR_COLLAPSED_KEY = "chattrail.toolbar.collapsed";
  const PAGE_STUDY_KEY_PREFIX = "chattrail.page-study";
  const FLOATING_MARGIN = 8;
  const STUDY_GLOSSARY = [
    ["时间轴", "timeline"],
    ["提示词", "prompt"],
    ["会话", "chat"],
    ["对话", "conversation"],
    ["问题", "question"],
    ["答案", "answer"],
    ["回复", "reply"],
    ["引用", "quote"],
    ["导出", "export"],
    ["设置", "settings"],
    ["用户", "user"],
    ["助手", "assistant"],
    ["模型", "model"],
    ["代码", "code"],
    ["函数", "function"],
    ["变量", "variable"],
    ["公式", "formula"],
    ["文件", "file"],
    ["标题", "title"],
    ["消息", "message"],
    ["内容", "content"],
    ["方向", "direction"],
    ["教育", "education"],
    ["信息", "information"],
    ["能力", "ability"],
    ["翻译", "translation"],
    ["学习", "learning"],
    ["步骤", "step"],
    ["示例", "example"],
    ["错误", "error"],
    ["修复", "fix"],
    ["调试", "debug"],
    ["优化", "optimize"],
    ["性能", "performance"],
    ["方案", "solution"],
    ["数据", "data"],
    ["文本", "text"],
    ["按钮", "button"],
    ["页面", "page"],
    ["本地", "local"],
    ["同步", "sync"],
    ["开关", "toggle"],
    ["预览", "preview"],
    ["复制", "copy"],
    ["搜索", "search"],
    ["标签", "tag"],
    ["输入框", "input"]
  ];
  const STUDY_ENTRIES = buildStudyEntries();
  const STUDY_PATTERN = buildStudyPattern();

  const DEFAULT_SETTINGS = {
    quoteReply: true,
    exportTools: true,
    promptLibrary: true,
    mermaidPreview: true,
    formulaCopy: true,
    titleSync: true,
    timestamps: true,
    wideChat: false,
    largeFont: false,
    visualEffect: "none"
  };

  const PLATFORM_CONFIGS = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      hosts: ["chatgpt.com", "chat.openai.com"]
    },
    {
      id: "doubao",
      name: "Doubao",
      hosts: ["doubao.com"]
    }
  ];

  const state = {
    platform: detectPlatform(),
    settings: { ...DEFAULT_SETTINGS },
    prompts: [],
    root: null,
    shadow: null,
    promptPanel: null,
    quoteButton: null,
    observer: null,
    scanTimer: 0,
    effectLayer: null,
    studyTooltipHost: null,
    studyTooltipOriginalEl: null,
    studyTooltipReplacementEl: null,
    toolbarCollapsed: false,
    pageStudyEnabled: true,
    pageStudyKey: "",
    titleBeforeSync: document.title,
    syncedTitle: ""
  };

  if (!state.platform) {
    return;
  }

  boot();

  async function boot() {
    const stored = await storageGet({
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.prompts]: []
    });

    state.settings = {
      ...DEFAULT_SETTINGS,
      ...(stored[STORAGE_KEYS.settings] || {})
    };
    state.prompts = normalizePromptList(stored[STORAGE_KEYS.prompts]);
    state.toolbarCollapsed = readBooleanFlag(TOOLBAR_COLLAPSED_KEY, false);
    state.pageStudyKey = getPageStudyKey();
    state.pageStudyEnabled = readBooleanFlag(state.pageStudyKey, true);
    state.titleBeforeSync = document.title;

    createToolbar();
    createStudyTooltip();
    createQuoteButton();
    attachStorageListener();
    attachRuntimeMessageListener();
    applySettings();
    scanPage();
    attachObservers();
    attachSelectionHandler();
  }

  function detectPlatform() {
    const host = window.location.hostname.toLowerCase();
    return PLATFORM_CONFIGS.find((platform) => {
      return platform.hosts.some((platformHost) => host === platformHost || host.endsWith(`.${platformHost}`));
    });
  }

  function createToolbar() {
    const host = document.createElement("div");
    host.id = "chattrail-enhancements-root";
    host.style.position = "fixed";
    host.style.left = "14px";
    host.style.bottom = "14px";
    host.style.zIndex = "2147483646";
    host.style.colorScheme = "light";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
          padding: 7px;
          backdrop-filter: blur(10px);
          cursor: grab;
          touch-action: none;
          user-select: none;
        }

        .toolbar.collapsed {
          gap: 6px;
        }

        .toolbar.dragging,
        .panel-header.dragging {
          cursor: grabbing;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .toolbar.collapsed .toolbar-actions > button:not(.study-toggle):not(.collapse-toggle) {
          display: none;
        }

        button {
          border: 1px solid rgba(15, 23, 42, 0.14);
          border-radius: 6px;
          background: #ffffff;
          color: #0f172a;
          cursor: pointer;
          font: 12px/1.2 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 7px 9px;
          white-space: nowrap;
        }

        button:hover {
          background: #ecfeff;
          border-color: rgba(20, 184, 166, 0.42);
        }

        .brand {
          color: #0f172a;
          font-size: 12px;
          font-weight: 800;
          padding: 0 5px;
        }

        .study-toggle.on {
          background: #ecfeff;
          border-color: rgba(20, 184, 166, 0.45);
          color: #115e59;
        }

        .study-toggle.off {
          background: #fff7ed;
          border-color: rgba(249, 115, 22, 0.35);
          color: #9a3412;
        }

        .study-toggle {
          min-width: 28px;
          padding: 5px 7px;
          font-size: 11px;
          font-weight: 700;
        }

        .collapse-toggle {
          width: 24px;
          min-width: 24px;
          height: 24px;
          padding: 0;
          font-size: 13px;
          line-height: 24px;
          text-align: center;
        }

        .chattrail-study-text {
          border-bottom: 1px dashed rgba(20, 184, 166, 0.48);
          color: #0f766e;
        }

        .chattrail-study-token {
          display: inline-flex;
          align-items: center;
          margin: 0 0.04em;
          padding: 0 0.22em;
          border: 1px solid rgba(20, 184, 166, 0.26);
          border-radius: 4px;
          background: rgba(236, 254, 255, 0.86);
          color: #0f766e;
          cursor: help;
          line-height: inherit;
          vertical-align: baseline;
        }

        .panel {
          position: absolute;
          left: 0;
          bottom: 48px;
          width: 360px;
          max-width: calc(100vw - 28px);
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22);
          display: none;
          overflow: hidden;
        }

        .panel.open {
          display: block;
        }

        .panel.below {
          bottom: auto;
          top: 48px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.1);
          background: #f8fafc;
          cursor: grab;
          touch-action: none;
          user-select: none;
        }

        .panel-title {
          color: #0f172a;
          font-size: 13px;
          font-weight: 800;
        }

        .panel-body {
          display: grid;
          gap: 10px;
          max-height: 52vh;
          overflow: auto;
          padding: 12px;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 6px;
          color: #0f172a;
          font: 12px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 8px;
        }

        textarea {
          min-height: 86px;
          resize: vertical;
        }

        .prompt-list {
          display: grid;
          gap: 8px;
        }

        .prompt-item {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 8px;
          display: grid;
          gap: 6px;
          padding: 8px;
        }

        .prompt-title {
          color: #0f172a;
          font-size: 13px;
          font-weight: 800;
        }

        .prompt-body {
          color: #475569;
          font-size: 12px;
          line-height: 1.35;
          max-height: 52px;
          overflow: hidden;
          white-space: pre-wrap;
        }

        .row {
          display: flex;
          gap: 6px;
        }

        .muted {
          color: #64748b;
          font-size: 12px;
          line-height: 1.4;
        }

        .toast {
          position: absolute;
          left: 0;
          bottom: 48px;
          max-width: 340px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          border-radius: 8px;
          background: #0f172a;
          color: #ffffff;
          display: none;
          font-size: 12px;
          line-height: 1.4;
          padding: 9px 11px;
        }

        .toast.visible {
          display: block;
        }

        .toast.below {
          bottom: auto;
          top: 48px;
        }
      </style>
      <div class="toolbar">
        <span class="brand">ChatTrail</span>
        <div class="toolbar-actions">
          <button type="button" class="study-toggle" data-action="toggle-page-study"></button>
          <button type="button" data-action="prompts">提示词</button>
          <button type="button" data-action="export-md">导出 MD</button>
          <button type="button" data-action="export-json">导出 JSON</button>
          <button type="button" data-action="settings">设置</button>
          <button type="button" class="collapse-toggle" data-action="toggle-collapse"></button>
        </div>
      </div>
      <section class="panel" aria-label="ChatTrail prompt library">
        <div class="panel-header">
          <span class="panel-title">提示词库</span>
          <button type="button" data-action="close-panel">关闭</button>
        </div>
        <div class="panel-body">
          <input type="search" data-role="prompt-search" placeholder="搜索标题、标签或内容">
          <div class="row">
            <button type="button" data-action="save-input">保存当前输入</button>
            <button type="button" data-action="new-prompt">新建提示词</button>
          </div>
          <div class="prompt-list" data-role="prompt-list"></div>
          <p class="muted">提示词只保存在本地浏览器。完整管理、备份和恢复请进入设置页。</p>
        </div>
      </section>
      <div class="toast" role="status"></div>
    `;

    document.documentElement.appendChild(host);
    initializeFloatingPosition(host, TOOLBAR_POSITION_KEY, () => {
      const rect = host.getBoundingClientRect();
      return {
        left: 14,
        top: window.innerHeight - rect.height - 14
      };
    });

    state.root = host;
    state.shadow = shadow;
    state.promptPanel = shadow.querySelector(".panel");

    const toolbar = shadow.querySelector(".toolbar");
    const panelHeader = shadow.querySelector(".panel-header");
    makeFloatingDraggable(host, toolbar, TOOLBAR_POSITION_KEY, toolbar);
    makeFloatingDraggable(host, panelHeader, TOOLBAR_POSITION_KEY, panelHeader);
    updateFloatingPanelPlacement();
    window.addEventListener("resize", () => {
      clampFloatingPosition(host, TOOLBAR_POSITION_KEY);
      updateFloatingPanelPlacement();
    }, { passive: true });

    renderToolbarState();
    shadow.addEventListener("click", handleToolbarClick);
    shadow.querySelector("[data-role='prompt-search']").addEventListener("input", renderPromptList);
  }

  function createQuoteButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "引用回复";
    button.style.position = "fixed";
    button.style.zIndex = "2147483647";
    button.style.display = "none";
    button.style.border = "1px solid rgba(15, 23, 42, 0.16)";
    button.style.borderRadius = "6px";
    button.style.background = "#0f172a";
    button.style.color = "#ffffff";
    button.style.cursor = "pointer";
    button.style.font = "12px/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    button.style.padding = "8px 10px";
    button.style.boxShadow = "0 12px 28px rgba(15, 23, 42, 0.22)";

    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      const selection = window.getSelection();
      const text = normalizeText(selection?.toString() || "");
      if (!text) {
        hideQuoteButton();
        return;
      }

      insertIntoInput(toBlockQuote(text));
      selection?.removeAllRanges();
      hideQuoteButton();
      showToast("已插入引用");
    });

    document.documentElement.appendChild(button);
    state.quoteButton = button;
  }

  function createStudyTooltip() {
    const host = document.createElement("div");
    host.id = "chattrail-study-tooltip";
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    host.style.zIndex = "2147483647";
    host.style.display = "none";
    host.style.pointerEvents = "none";
    host.style.colorScheme = "light";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .card {
          width: 220px;
          box-sizing: border-box;
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
          color: #0f172a;
          padding: 10px 12px;
        }

        .label {
          color: #0f766e;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .row {
          display: grid;
          gap: 2px;
        }

        .row + .row {
          margin-top: 8px;
        }

        .key {
          color: #64748b;
          font-size: 11px;
          line-height: 1.3;
        }

        .value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
          word-break: break-word;
        }
      </style>
      <div class="card" role="tooltip">
        <div class="label">学习卡片</div>
        <div class="row">
          <div class="key">原文</div>
          <div class="value value-original"></div>
        </div>
        <div class="row">
          <div class="key">学习</div>
          <div class="value value-replacement"></div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(host);
    state.studyTooltipHost = host;
    state.studyTooltipOriginalEl = shadow.querySelector(".value-original");
    state.studyTooltipReplacementEl = shadow.querySelector(".value-replacement");

    window.addEventListener("scroll", hideStudyTooltip, { passive: true });
    window.addEventListener("resize", hideStudyTooltip, { passive: true });
  }

  function handleToolbarClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    runAction(button.dataset.action);
  }

  function runAction(action) {
    if (action === "toggle-collapse") {
      toggleToolbarCollapsed();
      return;
    }

    if (action === "toggle-page-study") {
      togglePageStudy();
      return;
    }

    if (action === "prompts") {
      togglePromptPanel();
      return;
    }

    if (action === "close-panel") {
      closePromptPanel();
      return;
    }

    if (action === "save-input") {
      saveCurrentInputAsPrompt();
      return;
    }

    if (action === "new-prompt") {
      createPromptFromScratch();
      return;
    }

    if (action === "export-md") {
      exportConversation("markdown");
      return;
    }

    if (action === "export-json") {
      exportConversation("json");
      return;
    }

    if (action === "copy-debug") {
      copyDebugInfo();
      return;
    }

    if (action === "settings") {
      openOptionsPage();
    }
  }

  function togglePromptPanel() {
    if (!state.settings.promptLibrary) {
      showToast("提示词库已在设置中关闭");
      return;
    }

    if (state.toolbarCollapsed) {
      toggleToolbarCollapsed(false);
    }

    const isOpen = state.promptPanel.classList.toggle("open");
    if (isOpen) {
      updateFloatingPanelPlacement();
      renderPromptList();
    }
  }

  function closePromptPanel() {
    state.promptPanel.classList.remove("open");
  }

  function renderToolbarState() {
    if (!state.shadow) {
      return;
    }

    const toolbar = state.shadow.querySelector(".toolbar");
    const collapseButton = state.shadow.querySelector("[data-action='toggle-collapse']");
    const studyButton = state.shadow.querySelector("[data-action='toggle-page-study']");
    if (!toolbar || !collapseButton || !studyButton) {
      return;
    }

    toolbar.classList.toggle("collapsed", state.toolbarCollapsed);
    collapseButton.textContent = state.toolbarCollapsed ? "›" : "‹";
    collapseButton.title = state.toolbarCollapsed ? "展开工具栏" : "收起工具栏";
    collapseButton.setAttribute("aria-label", collapseButton.title);

    studyButton.textContent = state.pageStudyEnabled ? "学" : "原";
    studyButton.title = state.pageStudyEnabled
      ? "本页学习已开启"
      : "本页原文模式";
    studyButton.setAttribute("aria-label", studyButton.title);
    studyButton.classList.toggle("on", state.pageStudyEnabled);
    studyButton.classList.toggle("off", !state.pageStudyEnabled);
  }

  function toggleToolbarCollapsed(forceValue) {
    state.toolbarCollapsed = typeof forceValue === "boolean"
      ? forceValue
      : !state.toolbarCollapsed;
    writeBooleanFlag(TOOLBAR_COLLAPSED_KEY, state.toolbarCollapsed);

    if (state.toolbarCollapsed) {
      closePromptPanel();
    }

    renderToolbarState();
    updateFloatingPanelPlacement();
    window.requestAnimationFrame(() => clampFloatingPosition(state.root, TOOLBAR_POSITION_KEY));
  }

  function togglePageStudy() {
    refreshPageContext();
    state.pageStudyEnabled = !state.pageStudyEnabled;
    writeBooleanFlag(state.pageStudyKey, state.pageStudyEnabled);

    if (!state.pageStudyEnabled) {
      hideQuoteButton();
      hideStudyTooltip();
      closePromptPanel();
    }

    renderToolbarState();
    applySettings();
    scheduleScan();
    showToast(state.pageStudyEnabled ? "本页学习增强已开启" : "本页学习增强已关闭");
  }

  function renderPromptList() {
    const list = state.shadow.querySelector("[data-role='prompt-list']");
    const search = normalizeText(state.shadow.querySelector("[data-role='prompt-search']").value).toLowerCase();
    const prompts = state.prompts.filter((prompt) => {
      const haystack = `${prompt.title}\n${prompt.body}\n${prompt.tags || ""}`.toLowerCase();
      return !search || haystack.includes(search);
    });

    list.textContent = "";

    if (prompts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "还没有匹配的提示词。";
      list.appendChild(empty);
      return;
    }

    prompts.forEach((prompt) => {
      const item = document.createElement("article");
      item.className = "prompt-item";

      const title = document.createElement("div");
      title.className = "prompt-title";
      title.textContent = prompt.title || "未命名提示词";

      const body = document.createElement("div");
      body.className = "prompt-body";
      body.textContent = prompt.body;

      const actions = document.createElement("div");
      actions.className = "row";

      const insert = document.createElement("button");
      insert.type = "button";
      insert.textContent = "插入";
      insert.addEventListener("click", () => {
        insertIntoInput(prompt.body);
        closePromptPanel();
        showToast("已插入提示词");
      });

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "复制";
      copy.addEventListener("click", async () => {
        await copyText(prompt.body);
        showToast("已复制提示词");
      });

      actions.append(insert, copy);
      item.append(title, body, actions);
      list.appendChild(item);
    });
  }

  async function saveCurrentInputAsPrompt() {
    const input = findInputElement();
    const body = normalizeText(readInputValue(input));
    if (!body) {
      showToast("当前输入框是空的");
      return;
    }

    const title = truncateText(body.split("\n")[0], 48);
    state.prompts.unshift({
      id: createId(),
      title,
      body,
      tags: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await storageSet({ [STORAGE_KEYS.prompts]: state.prompts });
    renderPromptList();
    showToast("已保存到提示词库");
  }

  async function createPromptFromScratch() {
    const title = window.prompt("提示词标题");
    if (title === null) {
      return;
    }

    const body = window.prompt("提示词内容");
    if (!normalizeText(body || "")) {
      return;
    }

    state.prompts.unshift({
      id: createId(),
      title: normalizeText(title) || "未命名提示词",
      body: body.trim(),
      tags: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await storageSet({ [STORAGE_KEYS.prompts]: state.prompts });
    renderPromptList();
    showToast("已创建提示词");
  }

  function attachObservers() {
    state.observer = new MutationObserver(() => scheduleScan());
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener("focus", () => refreshStateFromStorage());
    window.addEventListener("chattrail:settings-updated", () => refreshStateFromStorage());
  }

  function attachStorageListener() {
    const api = getChromeApi();
    if (!api?.storage?.onChanged) {
      return;
    }

    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      if (changes[STORAGE_KEYS.settings] || changes[STORAGE_KEYS.prompts]) {
        refreshStateFromStorage();
      }
    });
  }

  function attachRuntimeMessageListener() {
    const api = getChromeApi();
    if (!api?.runtime?.onMessage) {
      return;
    }

    api.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.source !== "chattrail-popup") {
        return false;
      }

      try {
        runAction(message.action);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }

      return true;
    });
  }

  function attachSelectionHandler() {
    document.addEventListener("mouseup", () => {
      if (!state.settings.quoteReply || !state.pageStudyEnabled) {
        return;
      }

      window.setTimeout(showQuoteButtonForSelection, 0);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideQuoteButton();
        closePromptPanel();
      }
    });
  }

  function showQuoteButtonForSelection() {
    if (!state.pageStudyEnabled) {
      hideQuoteButton();
      return;
    }

    const selection = window.getSelection();
    const text = normalizeText(selection?.toString() || "");
    if (!text || text.length < 2) {
      hideQuoteButton();
      return;
    }

    const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;

    if (!anchor || state.root?.contains(anchor) || state.quoteButton?.contains(anchor)) {
      hideQuoteButton();
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    state.quoteButton.style.left = `${Math.round(Math.min(rect.left, window.innerWidth - 104))}px`;
    state.quoteButton.style.top = `${Math.round(Math.max(8, rect.top - 42))}px`;
    state.quoteButton.style.display = "block";
  }

  function hideQuoteButton() {
    if (state.quoteButton) {
      state.quoteButton.style.display = "none";
    }
  }

  async function refreshStateFromStorage() {
    const stored = await storageGet({
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.prompts]: []
    });
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...(stored[STORAGE_KEYS.settings] || {})
    };
    state.prompts = normalizePromptList(stored[STORAGE_KEYS.prompts]);
    refreshPageContext();
    applySettings();
    renderToolbarState();
    renderPromptList();
    scheduleScan();
  }

  function scheduleScan() {
    window.clearTimeout(state.scanTimer);
    state.scanTimer = window.setTimeout(scanPage, 260);
  }

  function scanPage() {
    refreshPageContext();

    if (!state.pageStudyEnabled) {
      clearLearningDecorations();
      return;
    }

    if (state.settings.titleSync) {
      syncTitle();
    } else {
      restoreSyncedTitle();
    }

    if (state.settings.timestamps) {
      decorateTimestamps();
    } else {
      clearTimestamps();
    }

    if (state.settings.formulaCopy) {
      decorateFormulaCopyButtons();
    } else {
      clearFormulaCopyButtons();
    }

    if (state.settings.mermaidPreview) {
      decorateMermaidBlocks();
    } else {
      clearMermaidPreviews();
    }

    decorateStudyText();
  }

  function applySettings() {
    document.documentElement.classList.toggle("chattrail-wide-chat", Boolean(state.pageStudyEnabled && state.settings.wideChat));
    document.documentElement.classList.toggle("chattrail-large-font", Boolean(state.pageStudyEnabled && state.settings.largeFont));
    applyVisualEffect();

    if (!state.pageStudyEnabled) {
      clearLearningDecorations();
    }
  }

  function refreshPageContext() {
    const pageStudyKey = getPageStudyKey();
    if (pageStudyKey === state.pageStudyKey) {
      return;
    }

    restoreSyncedTitle();
    state.pageStudyKey = pageStudyKey;
    state.pageStudyEnabled = readBooleanFlag(state.pageStudyKey, true);
    state.titleBeforeSync = document.title;
    state.syncedTitle = "";
    renderToolbarState();
    applySettings();
  }

  function clearLearningDecorations() {
    clearTimestamps();
    clearFormulaCopyButtons();
    clearMermaidPreviews();
    clearStudyText();
    restoreSyncedTitle();
    hideQuoteButton();
    hideStudyTooltip();
  }

  function syncTitle() {
    const messages = extractMessages();
    const firstUser = messages.find((message) => message.role === "user");
    if (!firstUser) {
      return;
    }

    const title = truncateText(firstUser.text.replace(/\n+/g, " "), 44);
    const nextTitle = title ? `${title} - ${state.platform.name}` : "";
    if (nextTitle && document.title !== nextTitle) {
      if (document.title !== state.syncedTitle) {
        state.titleBeforeSync = document.title;
      }

      document.title = nextTitle;
      state.syncedTitle = nextTitle;
    }
  }

  function restoreSyncedTitle() {
    if (state.syncedTitle && document.title === state.syncedTitle && state.titleBeforeSync) {
      document.title = state.titleBeforeSync;
    }

    state.syncedTitle = "";
  }

  function decorateTimestamps() {
    const messages = extractMessages().filter((message) => message.role === "user");
    messages.forEach((message) => {
      if (!message.element?.isConnected || message.element.querySelector(".chattrail-message-timestamp")) {
        return;
      }

      const key = `chattrail.ts.${state.platform.id}.${hashText(window.location.pathname)}.${message.id}`;
      let timestamp = localStorage.getItem(key);
      if (!timestamp) {
        timestamp = new Date().toISOString();
        localStorage.setItem(key, timestamp);
      }

      const badge = document.createElement("span");
      badge.className = "chattrail-message-timestamp";
      badge.textContent = formatTime(timestamp);
      badge.title = new Date(timestamp).toLocaleString();
      message.element.appendChild(badge);
    });
  }

  function clearTimestamps() {
    document.querySelectorAll(".chattrail-message-timestamp").forEach((badge) => badge.remove());
  }

  function decorateFormulaCopyButtons() {
    const formulas = Array.from(document.querySelectorAll(".katex, mjx-container, math, [data-latex], [data-tex]"))
      .filter((element) => !state.root?.contains(element))
      .filter((element) => !element.querySelector(".chattrail-formula-copy"));

    formulas.forEach((formula) => {
      const latex = extractLatex(formula);
      if (!latex) {
        return;
      }

      formula.classList.add("chattrail-formula-host");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "chattrail-formula-copy";
      button.textContent = "复制公式";
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await copyText(latex);
        showToast("已复制公式 LaTeX");
      });

      formula.appendChild(button);
    });
  }

  function clearFormulaCopyButtons() {
    document.querySelectorAll(".chattrail-formula-copy").forEach((button) => button.remove());
    document.querySelectorAll(".chattrail-formula-host").forEach((formula) => {
      formula.classList.remove("chattrail-formula-host");
    });
  }

  function decorateMermaidBlocks() {
    const codeBlocks = Array.from(document.querySelectorAll("pre code, code"))
      .filter((code) => !state.root?.contains(code))
      .filter((code) => !code.dataset.chattrailMermaid)
      .filter((code) => isMermaidCodeBlock(code));

    codeBlocks.forEach((code) => {
      code.dataset.chattrailMermaid = "true";

      const source = normalizeText(code.textContent || "");
      const pre = code.closest("pre") || code;
      const card = document.createElement("section");
      card.className = "chattrail-mermaid-card";

      const toolbar = document.createElement("div");
      toolbar.className = "chattrail-mermaid-toolbar";
      toolbar.innerHTML = "<strong>Mermaid</strong>";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = "预览";

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "复制源码";
      copy.addEventListener("click", async () => {
        await copyText(source);
        showToast("已复制 Mermaid 源码");
      });

      toolbar.append(toggle, copy);

      const preview = document.createElement("div");
      preview.className = "chattrail-mermaid-preview";
      preview.hidden = true;
      preview.appendChild(renderMermaidPreview(source));

      toggle.addEventListener("click", () => {
        preview.hidden = !preview.hidden;
        toggle.textContent = preview.hidden ? "预览" : "隐藏预览";
      });

      card.append(toolbar, preview);
      pre.insertAdjacentElement("afterend", card);
    });
  }

  function clearMermaidPreviews() {
    document.querySelectorAll(".chattrail-mermaid-card").forEach((card) => card.remove());
    document.querySelectorAll("[data-chattrail-mermaid]").forEach((code) => {
      delete code.dataset.chattrailMermaid;
    });
  }

  function decorateStudyText() {
    const messages = extractMessages();
    messages.forEach((message) => {
      if (!message.element?.isConnected) {
        return;
      }

      const walker = document.createTreeWalker(
        message.element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            return shouldSkipStudyTextNode(node)
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode);
        currentNode = walker.nextNode();
      }

      textNodes.forEach((node) => {
        const fragment = buildStudyFragment(node.nodeValue || "");
        if (!fragment) {
          return;
        }

        node.parentNode?.replaceChild(fragment, node);
      });
    });
  }

  function clearStudyText() {
    const parents = new Set();
    document.querySelectorAll(".chattrail-study-token, .chattrail-study-text").forEach((span) => {
      parents.add(span.parentNode);
      span.replaceWith(document.createTextNode(span.dataset.chattrailStudyOriginal || span.textContent || ""));
    });

    parents.forEach((parent) => parent?.normalize?.());
  }

  function shouldSkipStudyTextNode(node) {
    if (!node || !node.parentElement) {
      return true;
    }

    const text = node.nodeValue || "";
    if (!/\S/.test(text)) {
      return true;
    }

    const parent = node.parentElement;
    if (parent.closest(".chattrail-study-token, .chattrail-study-text, .chattrail-message-timestamp, .chattrail-formula-copy, .chattrail-mermaid-card, #chattrail-enhancements-root, #chattrail-timeline-root")) {
      return true;
    }

    return Boolean(parent.closest("code, pre, kbd, samp, var, math, mjx-container, .katex, script, style, textarea, button, select, option, svg, a, [contenteditable='true'], [role='textbox']"));
  }

  function buildStudyFragment(text) {
    STUDY_PATTERN.lastIndex = 0;
    let match = STUDY_PATTERN.exec(text);
    if (!match) {
      return null;
    }

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    while (match) {
      const entry = resolveStudyEntry(match[0]);
      if (entry && entry.target && entry.target !== match[0]) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        fragment.appendChild(createStudyToken(entry, match[0]));
        lastIndex = match.index + match[0].length;
      }

      match = STUDY_PATTERN.exec(text);
    }

    if (lastIndex === 0) {
      return null;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    return fragment;
  }

  function createStudyToken(entry, originalText) {
    const token = document.createElement("span");
    token.className = "chattrail-study-token";
    token.dataset.chattrailStudyOriginal = originalText;
    token.dataset.chattrailStudyReplacement = entry.target;
    token.textContent = entry.target;
    token.addEventListener("mouseenter", () => showStudyTooltip(token));
    token.addEventListener("mouseleave", hideStudyTooltip);

    return token;
  }

  function renderMermaidPreview(source) {
    const container = document.createElement("div");
    const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || "";

    if (/^(graph|flowchart)\b/i.test(firstLine)) {
      container.appendChild(renderFlowPreview(lines.slice(1)));
      return container;
    }

    if (/^sequenceDiagram\b/i.test(firstLine)) {
      container.appendChild(renderSequencePreview(lines.slice(1)));
      return container;
    }

    container.textContent = "已识别 Mermaid 代码块。当前内置预览支持 flowchart/graph 和 sequenceDiagram；其它图表可复制源码到 Mermaid 工具查看。";
    return container;
  }

  function renderFlowPreview(lines) {
    const edges = lines
      .map((line) => line.match(/(.+?)-->|(.+?)-\.->|(.+?)==>/) ? line : "")
      .filter(Boolean)
      .slice(0, 12);

    const wrapper = document.createElement("div");
    if (edges.length === 0) {
      wrapper.textContent = "Flowchart 源码已识别，但没有解析到简单连接线。";
      return wrapper;
    }

    const list = document.createElement("ol");
    edges.forEach((edge) => {
      const item = document.createElement("li");
      item.textContent = edge.replace(/\s+/g, " ");
      list.appendChild(item);
    });
    wrapper.appendChild(list);
    return wrapper;
  }

  function renderSequencePreview(lines) {
    const rows = lines
      .map((line) => line.match(/^(.+?)(->>|-->>|->|-->)(.+?):\s*(.+)$/))
      .filter(Boolean)
      .slice(0, 16);

    const wrapper = document.createElement("div");
    if (rows.length === 0) {
      wrapper.textContent = "SequenceDiagram 源码已识别，但没有解析到简单消息。";
      return wrapper;
    }

    const list = document.createElement("ol");
    rows.forEach((match) => {
      const item = document.createElement("li");
      item.textContent = `${match[1].trim()} -> ${match[3].trim()}: ${match[4].trim()}`;
      list.appendChild(item);
    });
    wrapper.appendChild(list);
    return wrapper;
  }

  function exportConversation(format) {
    if (!state.settings.exportTools) {
      showToast("导出工具已在设置中关闭");
      return;
    }

    const messages = extractMessages();
    if (messages.length === 0) {
      showToast("没有识别到可导出的消息");
      return;
    }

    const meta = {
      platform: state.platform.name,
      url: window.location.href,
      title: document.title,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length
    };

    if (format === "json") {
      downloadText(`${safeFileName(meta.title)}.json`, JSON.stringify({ meta, messages: messages.map(stripMessageElement) }, null, 2), "application/json");
      showToast("已导出 JSON");
      return;
    }

    const markdown = toMarkdown(meta, messages);
    downloadText(`${safeFileName(meta.title)}.md`, markdown, "text/markdown");
    showToast("已导出 Markdown");
  }

  async function copyDebugInfo() {
    const candidates = Array.from(document.querySelectorAll("main [class], [role='main'] [class], #root [class], [data-testid], [aria-label]"))
      .filter((element) => !state.root?.contains(element))
      .filter(isVisibleElement)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          className: truncateText(String(element.className || ""), 160),
          testId: element.getAttribute("data-testid") || "",
          ariaLabel: element.getAttribute("aria-label") || "",
          rect: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          text: truncateText(getCleanElementText(element), 180)
        };
      })
      .filter((item) => item.text.length >= 4 && item.rect.width >= 40 && item.rect.height >= 10)
      .sort((a, b) => a.rect.top - b.rect.top)
      .slice(0, 60);

    const payload = {
      platform: state.platform.id,
      url: window.location.href,
      title: document.title,
      capturedAt: new Date().toISOString(),
      candidates
    };

    await copyText(JSON.stringify(payload, null, 2));
    showToast("已复制诊断信息");
  }

  function extractMessages() {
    const directChatGpt = Array.from(document.querySelectorAll("[data-message-author-role]"))
      .filter(isVisibleElement)
      .map((element, index) => createMessage(element, element.getAttribute("data-message-author-role"), index))
      .filter(Boolean);

    if (directChatGpt.length > 0) {
      return removeDuplicateMessages(directChatGpt);
    }

    const explicit = Array.from(document.querySelectorAll([
      "[data-testid*='user']",
      "[data-testid*='assistant']",
      "[data-testid*='question']",
      "[data-testid*='answer']",
      "[class*='user']",
      "[class*='User']",
      "[class*='assistant']",
      "[class*='Assistant']",
      "[class*='question']",
      "[class*='Question']",
      "[class*='answer']",
      "[class*='Answer']",
      "[class*='message']",
      "[class*='Message']",
      "[class*='bubble']",
      "[class*='Bubble']"
    ].join(",")))
      .filter(isMessageCandidate)
      .map((element, index) => createMessage(element, inferRole(element), index))
      .filter(Boolean);

    const deduped = removeDuplicateMessages(explicit);
    if (deduped.length > 1) {
      return deduped;
    }

    const turns = Array.from(document.querySelectorAll("main article, [data-testid^='conversation-turn-']"))
      .filter(isMessageCandidate)
      .map((element, index) => createMessage(element, index % 2 === 0 ? "user" : "assistant", index))
      .filter(Boolean);

    return removeDuplicateMessages(turns);
  }

  function createMessage(element, role, index) {
    const text = getCleanElementText(element);
    if (!text || text.length < 2) {
      return null;
    }

    return {
      id: element.id || element.getAttribute("data-message-id") || element.getAttribute("data-testid") || `${index}-${hashText(text)}`,
      role: normalizeRole(role),
      text,
      element
    };
  }

  function inferRole(element) {
    const explicit = element.getAttribute("data-message-author-role");
    if (explicit) {
      return normalizeRole(explicit);
    }

    const signature = [
      element.id,
      element.className,
      Array.from(element.attributes || []).map((attribute) => `${attribute.name}=${attribute.value}`).join(" ")
    ].join(" ");

    if (/\b(user|human|question|query|prompt|self|mine|me|my|我|用户)\b/i.test(signature)) {
      return "user";
    }

    if (/\b(assistant|bot|answer|response|reply|ai|doubao|gpt|model|agent|助手|豆包)\b/i.test(signature)) {
      return "assistant";
    }

    if (state.platform.id === "doubao") {
      return isRightAligned(element) ? "user" : "assistant";
    }

    return "unknown";
  }

  function normalizeRole(role) {
    if (role === "user" || role === "assistant" || role === "system" || role === "tool") {
      return role;
    }

    return "unknown";
  }

  function removeDuplicateMessages(messages) {
    const result = [];
    messages
      .sort((a, b) => a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top)
      .forEach((message) => {
        if (result.some((existing) => existing.text === message.text || existing.element.contains(message.element))) {
          return;
        }
        result.push(message);
      });

    return result;
  }

  function isMessageCandidate(element) {
    if (!(element instanceof HTMLElement) || state.root?.contains(element) || !isVisibleElement(element)) {
      return false;
    }

    if (element.closest("nav, aside, header, footer, menu, dialog, [role='navigation'], [role='banner']")) {
      return false;
    }

    const text = getCleanElementText(element);
    const rect = element.getBoundingClientRect();
    return text.length >= 4 && text.length <= 18000 && rect.width >= 120 && rect.height >= 14;
  }

  function isRightAligned(element) {
    const rect = element.getBoundingClientRect();
    const root = element.parentElement?.closest("main, [role='main'], [class*='chat'], [class*='conversation'], #root") || document.documentElement;
    const rootRect = root.getBoundingClientRect();
    const rightGap = rootRect.right - rect.right;
    const leftGap = rect.left - rootRect.left;
    return rightGap <= Math.max(72, rootRect.width * 0.12) && leftGap >= rightGap + Math.max(96, rootRect.width * 0.14);
  }

  function findInputElement() {
    return document.querySelector("textarea, [contenteditable='true'], [role='textbox'], #prompt-textarea");
  }

  function readInputValue(input) {
    if (!input) {
      return "";
    }

    if ("value" in input) {
      return input.value || "";
    }

    return input.innerText || input.textContent || "";
  }

  function insertIntoInput(text) {
    const input = findInputElement();
    if (!input) {
      copyText(text);
      showToast("没有找到输入框，已复制到剪贴板");
      return;
    }

    input.focus();

    if ("value" in input) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
      input.selectionStart = input.selectionEnd = start + text.length;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return;
    }

    document.execCommand("insertText", false, text);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }

  function toBlockQuote(text) {
    return `${text.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  }

  function toMarkdown(meta, messages) {
    const lines = [
      `# ${meta.title}`,
      "",
      `- Platform: ${meta.platform}`,
      `- URL: ${meta.url}`,
      `- Exported: ${meta.exportedAt}`,
      "",
      "---",
      ""
    ];

    messages.forEach((message, index) => {
      lines.push(`## ${index + 1}. ${roleLabel(message.role)}`);
      lines.push("");
      lines.push(message.text);
      lines.push("");
    });

    return lines.join("\n");
  }

  function stripMessageElement(message) {
    return {
      id: message.id,
      role: message.role,
      text: message.text
    };
  }

  function downloadText(fileName, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function isMermaidCodeBlock(code) {
    const className = String(code.className || "");
    const source = normalizeText(code.textContent || "");
    return /language-mermaid|mermaid/i.test(className)
      || /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|erDiagram)\b/i.test(source);
  }

  function extractLatex(element) {
    const annotation = element.querySelector("annotation[encoding='application/x-tex']");
    if (annotation?.textContent) {
      return normalizeText(annotation.textContent);
    }

    const katexAnnotation = element.querySelector(".katex-mathml annotation");
    if (katexAnnotation?.textContent) {
      return normalizeText(katexAnnotation.textContent);
    }

    return normalizeText(element.getAttribute("data-latex") || element.getAttribute("data-tex") || element.getAttribute("alttext") || element.textContent || "");
  }

  function applyVisualEffect() {
    if (state.effectLayer) {
      state.effectLayer.remove();
      state.effectLayer = null;
    }

    if (!state.pageStudyEnabled || state.settings.visualEffect === "none") {
      return;
    }

    const pieces = {
      snow: "*",
      rain: "|",
      sakura: "•"
    };
    const piece = pieces[state.settings.visualEffect] || "*";
    const layer = document.createElement("div");
    layer.className = "chattrail-effect-layer";

    for (let index = 0; index < 28; index += 1) {
      const span = document.createElement("span");
      span.className = "chattrail-effect-piece";
      span.textContent = piece;
      span.style.left = `${Math.round(Math.random() * 100)}vw`;
      span.style.animationDuration = `${7 + Math.random() * 7}s`;
      span.style.animationDelay = `${Math.random() * 7}s`;
      span.style.opacity = String(0.35 + Math.random() * 0.45);
      layer.appendChild(span);
    }

    document.documentElement.appendChild(layer);
    state.effectLayer = layer;
  }

  function openOptionsPage() {
    const api = getChromeApi();
    if (!api?.runtime?.sendMessage) {
      showToast("请点击扩展图标打开设置");
      return;
    }

    try {
      api.runtime.sendMessage({
        source: "chattrail",
        action: "open-options"
      }, (response) => {
        if (api.runtime.lastError || !response?.ok) {
          showToast("设置页打开失败，请点击扩展图标打开设置");
        }
      });
    } catch (error) {
      if (!isExtensionContextInvalidated(error)) {
        showToast("设置页打开失败，请点击扩展图标打开设置");
      }
    }
  }

  async function storageGet(defaults) {
    if (getChromeApi()?.storage?.local) {
      try {
        return await chrome.storage.local.get(defaults);
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          return defaults;
        }
        throw error;
      }
    }

    const result = {};
    Object.keys(defaults).forEach((key) => {
      const raw = localStorage.getItem(key);
      result[key] = raw ? JSON.parse(raw) : defaults[key];
    });
    return result;
  }

  async function storageSet(values) {
    if (getChromeApi()?.storage?.local) {
      try {
        await chrome.storage.local.set(values);
        return;
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          return;
        }
        throw error;
      }
    }

    Object.entries(values).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }

  function getChromeApi() {
    return typeof chrome === "undefined" ? null : chrome;
  }

  function isExtensionContextInvalidated(error) {
    return /Extension context invalidated/i.test(error?.message || String(error || ""));
  }

  function normalizePromptList(value) {
    return Array.isArray(value) ? value.filter((prompt) => prompt && typeof prompt.body === "string") : [];
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.documentElement.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function showToast(message) {
    const toast = state.shadow?.querySelector(".toast");
    if (!toast) {
      return;
    }

    updateFloatingPanelPlacement();
    toast.textContent = message;
    toast.classList.add("visible");
    window.setTimeout(() => toast.classList.remove("visible"), 1800);
  }

  function initializeFloatingPosition(host, key, getDefaultPosition) {
    const savedPosition = readFloatingPosition(key);
    const position = savedPosition || getDefaultPosition();
    setFloatingPosition(host, clampFloatingPoint(position, host));
  }

  function makeFloatingDraggable(host, handle, key, classTarget) {
    if (!host || !handle) {
      return;
    }

    let dragState = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || shouldIgnoreDragStart(event.target)) {
        return;
      }

      const rect = host.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };

      classTarget?.classList.add("dragging");
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const nextPosition = clampFloatingPoint({
        left: event.clientX - dragState.offsetX,
        top: event.clientY - dragState.offsetY
      }, host);

      setFloatingPosition(host, nextPosition);
      updateFloatingPanelPlacement();
      event.preventDefault();
    });

    const finishDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      dragState = null;
      classTarget?.classList.remove("dragging");
      handle.releasePointerCapture?.(event.pointerId);
      writeFloatingPosition(key, currentFloatingPosition(host));
      updateFloatingPanelPlacement();
      event.preventDefault();
    };

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  }

  function shouldIgnoreDragStart(target) {
    return Boolean(target?.closest?.("button, input, textarea, select, a, [contenteditable='true'], [role='textbox']"));
  }

  function clampFloatingPosition(host, key) {
    if (!host) {
      return;
    }

    const position = clampFloatingPoint(currentFloatingPosition(host), host);
    setFloatingPosition(host, position);
    writeFloatingPosition(key, position);
  }

  function clampFloatingPoint(position, host) {
    const rect = host.getBoundingClientRect();
    const maxLeft = Math.max(FLOATING_MARGIN, window.innerWidth - rect.width - FLOATING_MARGIN);
    const maxTop = Math.max(FLOATING_MARGIN, window.innerHeight - rect.height - FLOATING_MARGIN);

    return {
      left: Math.round(clamp(position.left, FLOATING_MARGIN, maxLeft)),
      top: Math.round(clamp(position.top, FLOATING_MARGIN, maxTop))
    };
  }

  function currentFloatingPosition(host) {
    const rect = host.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top
    };
  }

  function setFloatingPosition(host, position) {
    host.style.left = `${position.left}px`;
    host.style.top = `${position.top}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
    host.style.transform = "none";
  }

  function updateFloatingPanelPlacement() {
    if (!state.root || !state.shadow) {
      return;
    }

    const rootRect = state.root.getBoundingClientRect();
    const shouldOpenBelow = rootRect.top < 280;
    state.promptPanel?.classList.toggle("below", shouldOpenBelow);
    state.shadow.querySelector(".toast")?.classList.toggle("below", shouldOpenBelow);
  }

  function showStudyTooltip(target) {
    if (!state.pageStudyEnabled || !state.studyTooltipHost || !target?.isConnected) {
      return;
    }

    const original = target.dataset.chattrailStudyOriginal || target.textContent || "";
    const replacement = target.dataset.chattrailStudyReplacement || target.textContent || "";
    state.studyTooltipOriginalEl.textContent = original;
    state.studyTooltipReplacementEl.textContent = replacement;

    state.studyTooltipHost.style.display = "block";
    state.studyTooltipHost.style.visibility = "hidden";

    const rect = target.getBoundingClientRect();
    const tooltipRect = state.studyTooltipHost.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - tooltipRect.width - 8);
    const preferredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.bottom + 10;

    if (top + tooltipRect.height > window.innerHeight - 8) {
      top = rect.top - tooltipRect.height - 10;
    }

    state.studyTooltipHost.style.left = `${Math.round(clamp(preferredLeft, 8, maxLeft))}px`;
    state.studyTooltipHost.style.top = `${Math.round(Math.max(8, top))}px`;
    state.studyTooltipHost.style.visibility = "visible";
  }

  function hideStudyTooltip() {
    if (!state.studyTooltipHost) {
      return;
    }

    state.studyTooltipHost.style.display = "none";
    state.studyTooltipHost.style.visibility = "hidden";
  }

  function getPageStudyKey() {
    return `${PAGE_STUDY_KEY_PREFIX}.${state.platform.id}.${hashText(`${window.location.origin}${window.location.pathname}`)}`;
  }

  function readBooleanFlag(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return defaultValue;
      }

      return JSON.parse(raw) === true;
    } catch (error) {
      return defaultValue;
    }
  }

  function writeBooleanFlag(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(Boolean(value)));
    } catch (error) {
      // Boolean UI preferences are best-effort only.
    }
  }

  function readFloatingPosition(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (Number.isFinite(value?.left) && Number.isFinite(value?.top)) {
        return value;
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function writeFloatingPosition(key, position) {
    try {
      localStorage.setItem(key, JSON.stringify(position));
    } catch (error) {
      // Position persistence is optional; the toolbar remains draggable even if storage is blocked.
    }
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  }

  function normalizeText(text) {
    return String(text)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function getCleanElementText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("[data-chattrail-study-original]").forEach((node) => {
      node.replaceWith(document.createTextNode(node.getAttribute("data-chattrail-study-original") || node.textContent || ""));
    });
    clone.querySelectorAll("[class^='chattrail-'], [class*=' chattrail-'], #chattrail-enhancements-root, #chattrail-timeline-root").forEach((node) => {
      node.remove();
    });
    return normalizeText(clone.textContent || "");
  }

  function truncateText(text, maxLength) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
  }

  function roleLabel(role) {
    if (role === "user") {
      return "用户";
    }

    if (role === "assistant") {
      return "助手";
    }

    return "消息";
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeFileName(name) {
    return truncateText((name || "chat").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim(), 80) || "chat";
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function buildStudyEntries() {
    return STUDY_GLOSSARY.flatMap(([source, target]) => {
      return [
        { source, target, key: source, latin: false },
        { source: target, target: source, key: target.toLowerCase(), latin: true }
      ];
    });
  }

  function buildStudyPattern() {
    const latinTerms = STUDY_ENTRIES
      .filter((entry) => entry.latin)
      .map((entry) => entry.source)
      .sort((left, right) => right.length - left.length)
      .map(escapeRegex);
    const nativeTerms = STUDY_ENTRIES
      .filter((entry) => !entry.latin)
      .map((entry) => entry.source)
      .sort((left, right) => right.length - left.length)
      .map(escapeRegex);
    const parts = [];

    if (latinTerms.length > 0) {
      parts.push(`\\b(?:${latinTerms.join("|")})\\b`);
    }

    if (nativeTerms.length > 0) {
      parts.push(`(?:${nativeTerms.join("|")})`);
    }

    return new RegExp(parts.join("|"), "giu");
  }

  function resolveStudyEntry(match) {
    const normalized = /[a-z]/i.test(match) ? match.toLowerCase() : match;
    return STUDY_ENTRIES.find((item) => item.key === normalized) || null;
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hashText(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
  }
})();
