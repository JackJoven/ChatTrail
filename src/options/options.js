(() => {
  "use strict";

  const STORAGE_KEYS = {
    prompts: "chattrail.prompts",
    settings: "chattrail.settings"
  };

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

  const state = {
    prompts: [],
    settings: { ...DEFAULT_SETTINGS }
  };

  document.addEventListener("DOMContentLoaded", boot);

  async function boot() {
    const stored = await chrome.storage.local.get({
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.prompts]: []
    });

    state.settings = {
      ...DEFAULT_SETTINGS,
      ...(stored[STORAGE_KEYS.settings] || {})
    };
    state.prompts = Array.isArray(stored[STORAGE_KEYS.prompts]) ? stored[STORAGE_KEYS.prompts] : [];

    bindSettings();
    bindPromptForm();
    bindBackupButtons();
    renderPrompts();
  }

  function bindSettings() {
    document.querySelectorAll("[data-setting]").forEach((input) => {
      input.checked = Boolean(state.settings[input.dataset.setting]);
      input.addEventListener("change", async () => {
        state.settings[input.dataset.setting] = input.checked;
        await saveSettings();
      });
    });

    const effect = document.querySelector("#visual-effect");
    effect.value = state.settings.visualEffect || "none";
    effect.addEventListener("change", async () => {
      state.settings.visualEffect = effect.value;
      await saveSettings();
    });
  }

  function bindPromptForm() {
    document.querySelector("#prompt-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = document.querySelector("#prompt-id").value || createId();
      const now = new Date().toISOString();
      const existing = state.prompts.find((prompt) => prompt.id === id);
      const prompt = {
        id,
        title: document.querySelector("#prompt-title").value.trim() || "未命名提示词",
        tags: document.querySelector("#prompt-tags").value.trim(),
        body: document.querySelector("#prompt-body").value.trim(),
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      if (!prompt.body) {
        window.alert("提示词内容不能为空。");
        return;
      }

      state.prompts = [prompt, ...state.prompts.filter((item) => item.id !== id)];
      await savePrompts();
      resetPromptForm();
      renderPrompts();
    });

    document.querySelector("#reset-prompt").addEventListener("click", resetPromptForm);
  }

  function bindBackupButtons() {
    document.querySelector("#export-backup").addEventListener("click", () => {
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: state.settings,
        prompts: state.prompts
      };
      downloadText("chattrail-backup.json", JSON.stringify(backup, null, 2), "application/json");
    });

    document.querySelector("#import-backup").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const text = await file.text();
      const backup = JSON.parse(text);
      state.settings = {
        ...DEFAULT_SETTINGS,
        ...(backup.settings || {})
      };
      state.prompts = Array.isArray(backup.prompts) ? backup.prompts : [];
      await chrome.storage.local.set({
        [STORAGE_KEYS.settings]: state.settings,
        [STORAGE_KEYS.prompts]: state.prompts
      });
      window.location.reload();
    });
  }

  function renderPrompts() {
    const list = document.querySelector("#prompt-list");
    list.textContent = "";

    if (state.prompts.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "还没有提示词。";
      list.appendChild(empty);
      return;
    }

    state.prompts.forEach((prompt) => {
      const item = document.createElement("article");
      item.className = "prompt-item";

      const title = document.createElement("h3");
      title.textContent = prompt.title || "未命名提示词";

      const meta = document.createElement("p");
      meta.textContent = prompt.tags ? `标签：${prompt.tags}` : "无标签";

      const body = document.createElement("p");
      body.textContent = prompt.body;

      const actions = document.createElement("div");
      actions.className = "actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => editPrompt(prompt));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "删除";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`删除提示词「${prompt.title}」？`)) {
          return;
        }

        state.prompts = state.prompts.filter((itemPrompt) => itemPrompt.id !== prompt.id);
        await savePrompts();
        renderPrompts();
      });

      actions.append(edit, remove);
      item.append(title, meta, body, actions);
      list.appendChild(item);
    });
  }

  function editPrompt(prompt) {
    document.querySelector("#prompt-id").value = prompt.id;
    document.querySelector("#prompt-title").value = prompt.title || "";
    document.querySelector("#prompt-tags").value = prompt.tags || "";
    document.querySelector("#prompt-body").value = prompt.body || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetPromptForm() {
    document.querySelector("#prompt-id").value = "";
    document.querySelector("#prompt-title").value = "";
    document.querySelector("#prompt-tags").value = "";
    document.querySelector("#prompt-body").value = "";
  }

  async function saveSettings() {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: state.settings });
  }

  async function savePrompts() {
    await chrome.storage.local.set({ [STORAGE_KEYS.prompts]: state.prompts });
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

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
})();
