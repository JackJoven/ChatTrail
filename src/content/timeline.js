(() => {
  "use strict";

  if (window.__CHATTRAIL_TIMELINE_LOADED__) {
    return;
  }
  window.__CHATTRAIL_TIMELINE_LOADED__ = true;

  const MIN_TEXT_LENGTH = 6;
  const MAX_PREVIEW_LENGTH = 180;
  const BUILD_DEBOUNCE_MS = 180;
  const ACTIVE_SCAN_THROTTLE_MS = 120;
  const HIGHLIGHT_MS = 1200;
  const TIMELINE_ROLE = "user";
  const TIMELINE_POSITION_KEY = "chattrail.timeline.position";
  const FLOATING_MARGIN = 8;

  const PLATFORM_ADAPTERS = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      hosts: ["chatgpt.com", "chat.openai.com"],
      rootSelectors: [
        "main",
        "[role='main']",
        "#__next"
      ],
      messageSelectors: [
        "[data-testid^='conversation-turn-']",
        "article[data-testid^='conversation-turn-']",
        "[data-message-author-role]",
        "main article"
      ],
      userMessageSelectors: [
        "[data-message-author-role='user']",
        "[data-testid='user-message']",
        "[data-testid*='user-message']"
      ],
      turnSelectors: [
        "article[data-testid^='conversation-turn-']",
        "[data-testid^='conversation-turn-']"
      ]
    },
    {
      id: "doubao",
      name: "Doubao",
      hosts: ["doubao.com"],
      rootSelectors: [
        "main",
        "[role='main']",
        "[class*='chat']",
        "[class*='conversation']",
        "#root"
      ],
      messageSelectors: [
        "[data-testid*='message']",
        "[data-testid*='conversation']",
        "[class~='message']",
        "[class~='Message']",
        "[class*='bubble']",
        "[class*='Bubble']",
        "[class*='answer']",
        "[class*='question']"
      ],
      userMessageSelectors: [
        "[data-testid*='user']",
        "[data-testid*='question']",
        "[data-testid*='human']",
        "[aria-label*='用户']",
        "[aria-label*='我的']",
        "[aria-label*='提问']",
        "[aria-label*='question']"
      ]
    }
  ];

  const state = {
    platform: null,
    messages: [],
    activeIndex: -1,
    collapsed: false,
    root: null,
    shadow: null,
    listEl: null,
    countEl: null,
    platformEl: null,
    statusEl: null,
    tooltipEl: null,
    rebuildTimer: 0,
    activeTimer: 0,
    observer: null
  };

  const platform = detectPlatform();
  if (!platform) {
    return;
  }
  state.platform = platform;

  boot();

  function boot() {
    createTimelineUi();
    rebuildTimeline("initial");
    attachObservers();
    attachKeyboardNavigation();
    window.addEventListener("scroll", scheduleActiveScan, { passive: true });
    window.addEventListener("resize", scheduleRebuild, { passive: true });
    window.addEventListener("resize", () => clampFloatingPosition(state.root, TIMELINE_POSITION_KEY), { passive: true });
  }

  function detectPlatform() {
    const host = window.location.hostname.toLowerCase();
    return PLATFORM_ADAPTERS.find((adapter) => {
      return adapter.hosts.some((adapterHost) => {
        return host === adapterHost || host.endsWith(`.${adapterHost}`);
      });
    });
  }

  function createTimelineUi() {
    const host = document.createElement("div");
    host.id = "chattrail-timeline-root";
    host.style.position = "fixed";
    host.style.right = "14px";
    host.style.top = "50%";
    host.style.transform = "translateY(-50%)";
    host.style.zIndex = "2147483647";
    host.style.colorScheme = "light";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .panel {
          width: 54px;
          max-height: min(70vh, 620px);
          box-sizing: border-box;
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: stretch;
          overflow: hidden;
        }

        .panel.collapsed {
          width: 36px;
        }

        .header {
          display: grid;
          gap: 2px;
          padding: 7px 5px 6px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.1);
          background: #f8fafc;
          cursor: grab;
          touch-action: none;
          user-select: none;
        }

        .panel.dragging .header {
          cursor: grabbing;
        }

        .platform {
          color: #0f172a;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.1;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .count {
          color: #475569;
          font-size: 10px;
          line-height: 1.1;
          text-align: center;
        }

        .toggle {
          height: 24px;
          border: 0;
          border-top: 1px solid rgba(15, 23, 42, 0.1);
          background: #ffffff;
          color: #334155;
          cursor: pointer;
          font-size: 13px;
          line-height: 24px;
          padding: 0;
        }

        .toggle:hover {
          background: #ecfeff;
        }

        .body {
          position: relative;
          overflow: auto;
          padding: 9px 0;
          scrollbar-width: thin;
        }

        .rail {
          position: absolute;
          left: 50%;
          top: 12px;
          bottom: 12px;
          width: 2px;
          transform: translateX(-50%);
          background: #cbd5e1;
        }

        .nodes {
          position: relative;
          display: grid;
          gap: 7px;
          justify-items: center;
          min-height: 24px;
        }

        .node {
          width: 18px;
          height: 18px;
          box-sizing: border-box;
          border: 2px solid #ffffff;
          border-radius: 8px;
          background: #64748b;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.22);
          cursor: pointer;
          padding: 0;
          transform: scale(0.86);
          transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
        }

        .node.user {
          background: #2563eb;
        }

        .node.assistant {
          background: #14b8a6;
        }

        .node.unknown {
          background: #64748b;
        }

        .node:hover {
          transform: scale(1);
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.28);
        }

        .node.active {
          transform: scale(1.12);
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.22), 0 2px 8px rgba(15, 23, 42, 0.28);
        }

        .status {
          display: none;
          padding: 8px 6px;
          color: #64748b;
          font-size: 10px;
          line-height: 1.25;
          text-align: center;
        }

        .empty .rail,
        .empty .nodes {
          display: none;
        }

        .empty .status {
          display: block;
        }

        .panel.collapsed .header,
        .panel.collapsed .body {
          display: none;
        }

        .tooltip {
          position: fixed;
          left: 8px;
          top: 50%;
          width: 280px;
          max-width: calc(100vw - 16px);
          box-sizing: border-box;
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
          color: #0f172a;
          display: none;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          line-height: 1.45;
          padding: 10px 12px;
          pointer-events: none;
          transform: translateY(-50%);
          white-space: pre-wrap;
        }

        .tooltip.visible {
          display: block;
        }

        .tooltip-title {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 4px;
        }
      </style>
      <section class="panel" aria-label="ChatTrail timeline">
        <header class="header">
          <div class="platform"></div>
          <div class="count"></div>
        </header>
        <div class="body">
          <div class="rail"></div>
          <div class="nodes"></div>
          <div class="status">等待消息加载</div>
        </div>
        <button class="toggle" type="button" title="折叠或展开时间轴">›</button>
      </section>
      <aside class="tooltip" role="tooltip">
        <div class="tooltip-title"></div>
        <div class="tooltip-text"></div>
      </aside>
    `;

    document.documentElement.appendChild(host);
    initializeFloatingPosition(host, TIMELINE_POSITION_KEY, () => {
      const rect = host.getBoundingClientRect();
      return {
        left: window.innerWidth - rect.width - 14,
        top: Math.round((window.innerHeight - rect.height) / 2)
      };
    });

    state.root = host;
    state.shadow = shadow;
    state.listEl = shadow.querySelector(".nodes");
    state.countEl = shadow.querySelector(".count");
    state.platformEl = shadow.querySelector(".platform");
    state.statusEl = shadow.querySelector(".status");
    state.tooltipEl = shadow.querySelector(".tooltip");
    state.platformEl.textContent = state.platform.name;

    const panel = shadow.querySelector(".panel");
    makeFloatingDraggable(host, shadow.querySelector(".header"), TIMELINE_POSITION_KEY, panel);

    shadow.querySelector(".toggle").addEventListener("click", () => {
      state.collapsed = !state.collapsed;
      panel.classList.toggle("collapsed", state.collapsed);
      shadow.querySelector(".toggle").textContent = state.collapsed ? "‹" : "›";
      hideTooltip();
      window.requestAnimationFrame(() => clampFloatingPosition(host, TIMELINE_POSITION_KEY));
    });
  }

  function attachObservers() {
    state.observer = new MutationObserver((mutations) => {
      if (mutations.some(shouldMutationTriggerRebuild)) {
        scheduleRebuild();
      }
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function shouldMutationTriggerRebuild(mutation) {
    const target = mutation.target.nodeType === Node.ELEMENT_NODE
      ? mutation.target
      : mutation.target.parentElement;

    if (!target || state.root?.contains(target)) {
      return false;
    }

    const text = normalizeText(target.textContent || "");
    if (text.length < MIN_TEXT_LENGTH) {
      return false;
    }

    return true;
  }

  function attachKeyboardNavigation() {
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || shouldIgnoreKeyboardEvent(event)) {
        return;
      }

      if (event.key === "j") {
        event.preventDefault();
        jumpRelative(1);
      }

      if (event.key === "k") {
        event.preventDefault();
        jumpRelative(-1);
      }
    }, true);
  }

  function shouldIgnoreKeyboardEvent(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return true;
    }

    const target = event.target;
    if (!target || !(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
  }

  function scheduleRebuild() {
    window.clearTimeout(state.rebuildTimer);
    state.rebuildTimer = window.setTimeout(() => rebuildTimeline("mutation"), BUILD_DEBOUNCE_MS);
  }

  function scheduleActiveScan() {
    if (state.activeTimer) {
      return;
    }

    state.activeTimer = window.setTimeout(() => {
      state.activeTimer = 0;
      updateActiveNode();
    }, ACTIVE_SCAN_THROTTLE_MS);
  }

  function rebuildTimeline(reason) {
    const messages = extractMessages(state.platform);

    if (sameMessageList(state.messages, messages)) {
      updateActiveNode();
      return;
    }

    state.messages = messages;
    renderNodes(reason);
    updateActiveNode();
  }

  function sameMessageList(previous, next) {
    if (previous.length !== next.length) {
      return false;
    }

    for (let index = 0; index < previous.length; index += 1) {
      if (previous[index].id !== next[index].id || previous[index].text !== next[index].text) {
        return false;
      }
    }

    return true;
  }

  function renderNodes() {
    state.listEl.textContent = "";
    state.countEl.textContent = `${state.messages.length} 条提问`;

    const body = state.shadow.querySelector(".body");
    body.classList.toggle("empty", state.messages.length === 0);
    state.statusEl.textContent = state.messages.length === 0
      ? "没有识别到你的消息"
      : "";

    const fragment = document.createDocumentFragment();
    state.messages.forEach((message, index) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `node ${message.role}`;
      node.setAttribute("aria-label", `跳到第 ${index + 1} 条消息`);
      node.dataset.index = String(index);

      node.addEventListener("click", () => jumpToMessage(index));
      node.addEventListener("mouseenter", () => showTooltip(index, node));
      node.addEventListener("mouseleave", hideTooltip);
      node.addEventListener("focus", () => showTooltip(index, node));
      node.addEventListener("blur", hideTooltip);

      fragment.appendChild(node);
    });

    state.listEl.appendChild(fragment);
  }

  function jumpRelative(offset) {
    if (state.messages.length === 0) {
      return;
    }

    const current = state.activeIndex >= 0 ? state.activeIndex : nearestMessageIndex();
    const next = clamp(current + offset, 0, state.messages.length - 1);
    jumpToMessage(next);
  }

  function jumpToMessage(index) {
    const message = state.messages[index];
    if (!message?.element?.isConnected) {
      scheduleRebuild();
      return;
    }

    message.element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    highlightMessage(message.element);
    setActiveIndex(index);
  }

  function highlightMessage(element) {
    element.classList.add("chattrail-message-highlight");
    window.setTimeout(() => {
      element.classList.remove("chattrail-message-highlight");
    }, HIGHLIGHT_MS);
  }

  function updateActiveNode() {
    if (state.messages.length === 0) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex(nearestMessageIndex());
  }

  function nearestMessageIndex() {
    const viewportAnchor = window.innerHeight * 0.38;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    state.messages.forEach((message, index) => {
      if (!message.element?.isConnected) {
        return;
      }

      const rect = message.element.getBoundingClientRect();
      const messageAnchor = rect.top + Math.min(rect.height / 2, 80);
      const distance = Math.abs(messageAnchor - viewportAnchor);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function setActiveIndex(index) {
    if (state.activeIndex === index) {
      return;
    }

    state.activeIndex = index;
    const nodes = state.listEl.querySelectorAll(".node");
    nodes.forEach((node, nodeIndex) => {
      node.classList.toggle("active", nodeIndex === index);
    });

    const activeNode = nodes[index];
    if (activeNode) {
      activeNode.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    }
  }

  function showTooltip(index, node) {
    const message = state.messages[index];
    if (!message) {
      return;
    }

    const title = state.tooltipEl.querySelector(".tooltip-title");
    const text = state.tooltipEl.querySelector(".tooltip-text");
    title.textContent = `${index + 1}. ${roleLabel(message.role)}`;
    text.textContent = message.preview;

    const nodeRect = node.getBoundingClientRect();
    const tooltipWidth = Math.min(280, window.innerWidth - FLOATING_MARGIN * 2);
    const shouldOpenLeft = nodeRect.left > window.innerWidth / 2;
    const preferredLeft = shouldOpenLeft
      ? nodeRect.left - tooltipWidth - 12
      : nodeRect.right + 12;
    const maxLeft = Math.max(FLOATING_MARGIN, window.innerWidth - tooltipWidth - FLOATING_MARGIN);
    const top = clamp(
      Math.round(nodeRect.top + nodeRect.height / 2),
      FLOATING_MARGIN + 20,
      Math.max(FLOATING_MARGIN + 20, window.innerHeight - FLOATING_MARGIN - 20)
    );

    state.tooltipEl.style.left = `${Math.round(clamp(preferredLeft, FLOATING_MARGIN, maxLeft))}px`;
    state.tooltipEl.style.top = `${top}px`;
    state.tooltipEl.classList.add("visible");
  }

  function hideTooltip() {
    state.tooltipEl?.classList.remove("visible");
  }

  function extractMessages(adapter) {
    const roots = resolveRoots(adapter);
    const platformTimelineMessages = extractPlatformTimelineMessages(adapter, roots);
    if (platformTimelineMessages.length > 0) {
      return platformTimelineMessages;
    }

    const selectorMessages = uniqueElements(roots.flatMap((root) => {
      return adapter.messageSelectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
    }));

    const primaryMessages = normalizeMessageElements(selectorMessages, adapter.id);
    const primaryTimelineMessages = filterTimelineMessages(primaryMessages);
    if (primaryTimelineMessages.length > 0) {
      return primaryTimelineMessages;
    }

    return filterTimelineMessages(normalizeMessageElements(extractHeuristicMessageElements(roots), adapter.id));
  }

  function filterTimelineMessages(messages) {
    return messages.filter((message) => message.role === TIMELINE_ROLE);
  }

  function extractPlatformTimelineMessages(adapter, roots) {
    if (adapter.id === "chatgpt") {
      return extractChatGptUserMessages(adapter, roots);
    }

    if (adapter.id === "doubao") {
      return extractDoubaoUserMessages(adapter, roots);
    }

    return [];
  }

  function extractChatGptUserMessages(adapter, roots) {
    const directUserElements = queryWithinRoots(roots, adapter.userMessageSelectors);
    const directUserMessages = normalizeMessageElements(directUserElements, adapter.id, TIMELINE_ROLE);
    if (directUserMessages.length > 0) {
      return directUserMessages;
    }

    const turnElements = queryWithinRoots(roots, adapter.turnSelectors);
    const userTurns = turnElements.filter((element) => {
      return Boolean(element.querySelector(adapter.userMessageSelectors.join(",")));
    });
    const userTurnMessages = normalizeMessageElements(userTurns, adapter.id, TIMELINE_ROLE);
    if (userTurnMessages.length > 0) {
      return userTurnMessages;
    }

    const turnFallback = turnElements.filter((_, index) => index % 2 === 0);
    return normalizeMessageElements(turnFallback, adapter.id, TIMELINE_ROLE);
  }

  function extractDoubaoUserMessages(adapter, roots) {
    const conversationElements = extractDoubaoConversationElements(adapter, roots);
    const selectedUserTurns = selectDoubaoUserTurns(conversationElements);
    if (selectedUserTurns.length > 0) {
      return normalizeMessageElements(selectedUserTurns, adapter.id, TIMELINE_ROLE);
    }

    const explicitUserElements = uniqueElements([
      ...queryWithinRoots(roots, adapter.userMessageSelectors),
      ...queryDoubaoUserClassElements(roots)
    ]).filter(isDoubaoUserMessageCandidate);

    return normalizeMessageElements(explicitUserElements, adapter.id, TIMELINE_ROLE);
  }

  function extractDoubaoConversationElements(adapter, roots) {
    const selectorElements = uniqueElements(roots.flatMap((root) => {
      return adapter.messageSelectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
    }));

    const heuristicElements = extractHeuristicMessageElements(roots);
    const turnElements = uniqueElements([
      ...selectorElements,
      ...heuristicElements
    ].map(resolveDoubaoTurnElement))
      .filter(isDoubaoConversationElement);

    return removeDoubaoDuplicateTurns(turnElements)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .slice(0, 240);
  }

  function selectDoubaoUserTurns(elements) {
    if (elements.length === 0) {
      return [];
    }

    const explicitUsers = elements.filter((element) => {
      return isDoubaoUserMessageCandidate(element) && hasExplicitUserMarker(element);
    });

    if (explicitUsers.length > 0 && explicitUsers.length < elements.length) {
      return explicitUsers;
    }

    const scored = elements.map((element, index) => ({
      element,
      index,
      score: scoreDoubaoUserLikelihood(element)
    }));

    // Doubao conversations normally alternate user/assistant. When explicit
    // markers are unavailable, prefer the first turn sequence instead of
    // flipping based on layout; the previous layout-scored fallback could pick
    // assistant answers on real Doubao pages.
    const even = scored.filter((item) => item.index % 2 === 0);
    return even
      .filter((item) => item.score > -2)
      .map((item) => item.element);
  }

  function isDoubaoConversationElement(element) {
    if (!(element instanceof HTMLElement) || state.root?.contains(element) || !isVisibleElement(element)) {
      return false;
    }

    if (element.closest("nav, aside, header, footer, menu, dialog, [role='navigation'], [role='banner']")) {
      return false;
    }

    const text = normalizeText(element.innerText || element.textContent || "");
    if (text.length < MIN_TEXT_LENGTH || text.length > 20000) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const root = resolveRoleRoot(element);
    const rootRect = root.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 14 || rect.width > rootRect.width * 0.96) {
      return false;
    }

    return true;
  }

  function resolveDoubaoTurnElement(element) {
    if (!(element instanceof HTMLElement)) {
      return element;
    }

    const candidates = [];
    let current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      if (isDoubaoTurnLikeElement(current)) {
        candidates.push(current);
      }
      current = current.parentElement;
    }

    if (candidates.length === 0) {
      return element;
    }

    return candidates
      .filter((candidate) => {
        const root = resolveRoleRoot(candidate);
        const rootRect = root.getBoundingClientRect();
        const rect = candidate.getBoundingClientRect();
        return rootRect.width <= 0 || rect.width <= rootRect.width * 0.94;
      })
      .sort((a, b) => elementArea(b) - elementArea(a))[0] || candidates[0];
  }

  function isDoubaoTurnLikeElement(element) {
    const signature = elementSignature(element);
    if (/\b(message|bubble|question|answer|reply|conversation)\b/i.test(signature)) {
      return true;
    }

    return classTokens(element).some((token) => {
      return /^(message|bubble|question|answer|reply|user|human|assistant|bot)$/i.test(token);
    });
  }

  function removeDoubaoDuplicateTurns(elements) {
    const result = [];

    elements.forEach((element) => {
      const duplicateIndex = result.findIndex((existing) => {
        const sameText = normalizeText(existing.innerText || existing.textContent || "") === normalizeText(element.innerText || element.textContent || "");
        const contains = existing.contains(element) || element.contains(existing);
        const overlap = rectangleOverlapRatio(existing.getBoundingClientRect(), element.getBoundingClientRect()) > 0.82;
        return sameText || contains || overlap;
      });

      if (duplicateIndex === -1) {
        result.push(element);
        return;
      }

      if (shouldPreferDoubaoTurn(element, result[duplicateIndex])) {
        result[duplicateIndex] = element;
      }
    });

    return result;
  }

  function shouldPreferDoubaoTurn(candidate, existing) {
    const candidateScore = scoreDoubaoTurnContainer(candidate);
    const existingScore = scoreDoubaoTurnContainer(existing);
    if (candidateScore !== existingScore) {
      return candidateScore > existingScore;
    }

    return elementArea(candidate) > elementArea(existing);
  }

  function scoreDoubaoTurnContainer(element) {
    let score = 0;
    const signature = elementSignature(element);

    if (/\b(question|answer|bubble)\b/i.test(signature)) {
      score += 3;
    }

    if (/\b(message|reply)\b/i.test(signature)) {
      score += 1;
    }

    if (element.closest("nav, aside, header, footer, menu")) {
      score -= 4;
    }

    const root = resolveRoleRoot(element);
    const rootRect = root.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (rootRect.width > 0 && rect.width > rootRect.width * 0.92) {
      score -= 2;
    }

    return score;
  }

  function scoreDoubaoUserLikelihood(element) {
    let score = 0;

    if (hasExplicitUserMarker(element)) {
      score += 4;
    }

    if (isExplicitAssistantElement(element)) {
      score -= 5;
    }

    if (isRightAlignedUserBubble(element)) {
      score += 2;
    }

    if (isLeftAlignedAssistantBubble(element)) {
      score -= 2;
    }

    const text = normalizeText(element.innerText || element.textContent || "");
    if (text.length > 1200) {
      score -= 1;
    }

    if (element.querySelector("pre, code, table, ol, ul")) {
      score -= 1;
    }

    const interactiveCount = element.querySelectorAll("button, a, input, textarea, select").length;
    if (interactiveCount > 2) {
      score -= 1;
    }

    return score;
  }

  function queryDoubaoUserClassElements(roots) {
    const candidates = uniqueElements(roots.flatMap((root) => {
      return Array.from(root.querySelectorAll("[class]"));
    }));

    return candidates.filter((element) => {
      const tokens = classTokens(element);
      return tokens.some((token) => {
        return /^(user|human|question|query|prompt|mine|self|ask|me|my)$/i.test(token);
      });
    });
  }

  function isDoubaoUserMessageCandidate(element) {
    if (!(element instanceof HTMLElement) || state.root?.contains(element) || !isVisibleElement(element)) {
      return false;
    }

    if (isExplicitAssistantElement(element)) {
      return false;
    }

    const text = normalizeText(element.innerText || element.textContent || "");
    if (text.length < MIN_TEXT_LENGTH || text.length > 8000) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const root = resolveRoleRoot(element);
    const rootRect = root.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 14 || rect.width > rootRect.width * 0.88) {
      return false;
    }

    return hasExplicitUserMarker(element) || isRightAlignedUserBubble(element);
  }

  function queryWithinRoots(roots, selectors) {
    if (!selectors?.length) {
      return [];
    }

    return uniqueElements(roots.flatMap((root) => {
      return selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
    }));
  }

  function resolveRoots(adapter) {
    const roots = uniqueElements(adapter.rootSelectors.flatMap((selector) => {
      return Array.from(document.querySelectorAll(selector));
    }));

    const visibleRoots = roots.filter((root) => {
      return isVisibleElement(root) && !state.root?.contains(root);
    });

    return visibleRoots.length > 0 ? visibleRoots : [document.body];
  }

  function extractHeuristicMessageElements(roots) {
    const selectors = [
      "article",
      "[data-testid]",
      "[data-message-id]",
      "[data-message-author-role]",
      "[class*='message']",
      "[class*='Message']",
      "[class*='chat']",
      "[class*='Chat']",
      "[class*='conversation']",
      "[class*='Conversation']",
      "[class*='dialog']",
      "[class*='bubble']",
      "[class*='Bubble']",
      "[class*='answer']",
      "[class*='question']"
    ];

    const candidates = uniqueElements(roots.flatMap((root) => {
      return selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
    }));

    const filtered = candidates
      .filter(isMessageCandidate)
      .filter((element) => !containsBetterNestedCandidate(element, candidates))
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    return removeOverlappingDuplicates(filtered).slice(0, 240);
  }

  function isMessageCandidate(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (state.root?.contains(element)) {
      return false;
    }

    if (element.closest("nav, aside, header, footer, menu, dialog, [role='navigation'], [role='banner']")) {
      return false;
    }

    if (!isVisibleElement(element)) {
      return false;
    }

    const text = normalizeText(element.innerText || element.textContent || "");
    if (text.length < MIN_TEXT_LENGTH) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 18) {
      return false;
    }

    if (text.length > 18000) {
      return false;
    }

    return scoreMessageCandidate(element, text) >= 3;
  }

  function scoreMessageCandidate(element, text) {
    const signature = elementSignature(element);
    let score = 0;

    if (/\b(message|chat|conversation|bubble|answer|question|turn)\b/i.test(signature)) {
      score += 3;
    }

    if (/\b(user|assistant|human|bot|ai|self)\b/i.test(signature)) {
      score += 2;
    }

    if (element.matches("article, [data-testid], [data-message-id], [data-message-author-role]")) {
      score += 2;
    }

    if (text.length >= 24) {
      score += 1;
    }

    const interactiveCount = element.querySelectorAll("button, a, input, textarea, select").length;
    if (interactiveCount > 8) {
      score -= 3;
    }

    return score;
  }

  function containsBetterNestedCandidate(element, allCandidates) {
    const text = normalizeText(element.innerText || element.textContent || "");

    return allCandidates.some((candidate) => {
      if (candidate === element || !element.contains(candidate) || !isVisibleElement(candidate)) {
        return false;
      }

      const childText = normalizeText(candidate.innerText || candidate.textContent || "");
      if (childText.length < MIN_TEXT_LENGTH) {
        return false;
      }

      return childText.length >= text.length * 0.72 && scoreMessageCandidate(candidate, childText) >= scoreMessageCandidate(element, text);
    });
  }

  function removeOverlappingDuplicates(elements) {
    const result = [];

    elements.forEach((element) => {
      const text = normalizeText(element.innerText || element.textContent || "");
      const rect = element.getBoundingClientRect();
      const duplicateIndex = result.findIndex((existing) => {
        const existingText = normalizeText(existing.innerText || existing.textContent || "");
        const existingRect = existing.getBoundingClientRect();
        return text === existingText || rectangleOverlapRatio(rect, existingRect) > 0.86;
      });

      if (duplicateIndex === -1) {
        result.push(element);
        return;
      }

      const existing = result[duplicateIndex];
      const existingText = normalizeText(existing.innerText || existing.textContent || "");
      if (text.length < existingText.length) {
        result[duplicateIndex] = element;
      }
    });

    return result;
  }

  function normalizeMessageElements(elements, platformId, forcedRole) {
    const unique = uniqueElements(elements)
      .filter((element) => element instanceof HTMLElement)
      .filter((element) => !state.root?.contains(element))
      .filter(isVisibleElement)
      .map((element, index) => createMessageFromElement(element, index, platformId, forcedRole))
      .filter(Boolean)
      .sort((a, b) => {
        return a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top;
      });

    return removeMessageDuplicates(unique);
  }

  function createMessageFromElement(element, index, platformId, forcedRole) {
    const text = normalizeText(element.innerText || element.textContent || "");
    if (text.length < MIN_TEXT_LENGTH) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 14) {
      return null;
    }

    return {
      id: element.id || element.getAttribute("data-message-id") || element.getAttribute("data-testid") || `${platformId}-${index}-${hashText(text)}`,
      role: forcedRole || inferRole(element, platformId),
      text,
      preview: truncateText(text, MAX_PREVIEW_LENGTH),
      element
    };
  }

  function removeMessageDuplicates(messages) {
    const result = [];

    messages.forEach((message) => {
      const duplicateIndex = result.findIndex((existing) => {
        if (existing.element === message.element) {
          return true;
        }

        if (existing.text === message.text) {
          return true;
        }

        if (existing.element.contains(message.element) && message.text.length >= existing.text.length * 0.7) {
          return true;
        }

        if (message.element.contains(existing.element) && existing.text.length >= message.text.length * 0.7) {
          return true;
        }

        return false;
      });

      if (duplicateIndex === -1) {
        result.push(message);
        return;
      }

      if (shouldPreferMessage(message, result[duplicateIndex])) {
        result[duplicateIndex] = message;
      }
    });

    return result;
  }

  function shouldPreferMessage(candidate, existing) {
    if (candidate.role === TIMELINE_ROLE && existing.role !== TIMELINE_ROLE) {
      return true;
    }

    if (candidate.role !== TIMELINE_ROLE && existing.role === TIMELINE_ROLE) {
      return false;
    }

    if (candidate.text.length < existing.text.length) {
      return true;
    }

    if (candidate.text === existing.text) {
      return elementArea(candidate.element) < elementArea(existing.element);
    }

    return false;
  }

  function inferRole(element, platformId) {
    const role = element.getAttribute("data-message-author-role");
    if (role === "user" || role === "assistant" || role === "system" || role === "tool") {
      return role;
    }

    const signature = elementSignature(element);
    if (/\b(user|human|question|query|prompt|ask|self|mine|right|me|my|我|用户)\b/i.test(signature)) {
      return "user";
    }

    if (/\b(assistant|bot|answer|response|reply|ai|doubao|gpt|model|agent|left|助手|豆包)\b/i.test(signature)) {
      return "assistant";
    }

    const layoutRole = inferRoleFromLayout(element, platformId);
    if (layoutRole) {
      return layoutRole;
    }

    return "unknown";
  }

  function inferRoleFromLayout(element, platformId) {
    if (platformId !== "doubao") {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) {
      return null;
    }

    if (isRightAlignedUserBubble(element)) {
      return "user";
    }

    if (isLeftAlignedAssistantBubble(element)) {
      return "assistant";
    }

    return null;
  }

  function isExplicitUserElement(element) {
    return hasExplicitUserMarker(element);
  }

  function hasExplicitUserMarker(element) {
    const signature = elementSignature(element);
    if (/\b(human|question|mine|self|我|用户|我的|提问)\b/i.test(signature)) {
      return true;
    }

    return classTokens(element).some((token) => /^(user|human|question|mine|self)$/i.test(token));
  }

  function isExplicitAssistantElement(element) {
    return /\b(assistant|bot|answer|response|reply|ai|doubao|gpt|model|agent|助手|豆包)\b/i.test(elementSignature(element));
  }

  function isRightAlignedUserBubble(element) {
    const rect = element.getBoundingClientRect();
    const root = resolveRoleRoot(element);
    const rootRect = root.getBoundingClientRect();
    if (rect.width <= 0 || rootRect.width <= 0 || rect.width > rootRect.width * 0.84) {
      return false;
    }

    const rightGap = rootRect.right - rect.right;
    const leftGap = rect.left - rootRect.left;
    const closeToRight = rightGap <= Math.max(72, rootRect.width * 0.12);
    const clearlyRight = leftGap >= rightGap + Math.max(96, rootRect.width * 0.14);

    const style = window.getComputedStyle(element);
    const flexEnd = style.alignSelf === "flex-end" || element.style.marginLeft === "auto";

    return (closeToRight && clearlyRight) || flexEnd;
  }

  function isLeftAlignedAssistantBubble(element) {
    const rect = element.getBoundingClientRect();
    const root = resolveRoleRoot(element);
    const rootRect = root.getBoundingClientRect();
    if (rect.width <= 0 || rootRect.width <= 0 || rect.width > rootRect.width * 0.9) {
      return false;
    }

    const rightGap = rootRect.right - rect.right;
    const leftGap = rect.left - rootRect.left;
    const closeToLeft = leftGap <= Math.max(72, rootRect.width * 0.12);
    const clearlyLeft = rightGap >= leftGap + Math.max(96, rootRect.width * 0.14);

    return closeToLeft && clearlyLeft;
  }

  function resolveRoleRoot(element) {
    const root = element.parentElement?.closest("main, [role='main'], [class*='chat'], [class*='Chat'], [class*='conversation'], [class*='Conversation'], #root");
    if (root && isVisibleElement(root)) {
      return root;
    }

    return document.documentElement;
  }

  function elementSignature(element) {
    return [
      element.tagName,
      element.id,
      element.className,
      Array.from(element.attributes || [])
        .filter((attribute) => attribute.name.startsWith("data-") || attribute.name === "aria-label" || attribute.name === "role")
        .map((attribute) => `${attribute.name}=${attribute.value}`)
        .join(" ")
    ].join(" ");
  }

  function classTokens(element) {
    return String(element.className || "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return rect.width > 0
      && rect.height > 0
      && style.visibility !== "hidden"
      && style.display !== "none"
      && Number(style.opacity) !== 0;
  }

  function normalizeText(text) {
    return String(text)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1)}…`;
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

      hideTooltip();
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
      hideTooltip();
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
      event.preventDefault();
    };

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  }

  function shouldIgnoreDragStart(target) {
    return Boolean(target?.closest?.("button, input, textarea, select, a, [contenteditable='true'], [role='textbox'], .node"));
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
      // Position persistence is a convenience; dragging should still work when storage is blocked.
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements)).filter(Boolean);
  }

  function rectangleOverlapRatio(a, b) {
    const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const overlapArea = xOverlap * yOverlap;
    const minArea = Math.min(a.width * a.height, b.width * b.height);

    if (minArea === 0) {
      return 0;
    }

    return overlapArea / minArea;
  }

  function elementArea(element) {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function hashText(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }

    return Math.abs(hash).toString(36);
  }
})();
