# ChatTrail

ChatTrail is a browser extension prototype for AI chat workflow enhancements.

## Current Scope

- ChatGPT: `chatgpt.com`, `chat.openai.com`
- Doubao: `doubao.com`, `www.doubao.com`, `*.doubao.com`

## Timeline Navigation

- Right-side timeline nodes are generated from your visible user messages only.
- Click a node to jump to your message.
- Hover a node to preview your message.
- Press `j` / `k` to move to the next or previous user message when the chat input is not focused.

## Current Features

- User-message timeline navigation for ChatGPT and Doubao.
- Markdown and JSON export for the current visible conversation.
- Prompt library with local storage, insertion, backup, and restore.
- Quote reply from selected text.
- Formula copy buttons for KaTeX, MathJax, MathML, and `data-latex` nodes.
- Lightweight Mermaid detection and preview for simple flowchart and sequence diagrams.
- User message timestamps, title sync, chat width/font tweaks, and optional visual effects.

## How to Use

- Open ChatGPT or Doubao after loading the extension.
- Use the right-side timeline to jump between your own questions.
- Click the ChatTrail extension icon to open quick actions: prompt library, Markdown export, JSON export, and settings.
- On supported chat pages, a ChatTrail toolbar also appears near the lower-left corner with the same quick actions.
- Select text in a conversation to show the quote-reply button.
- Hover a recognized formula to copy LaTeX.
- Open settings to manage prompts, feature switches, visual effects, and backup/restore.

## Local Installation

1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Click "Load unpacked".
5. Select this folder: `C:\AI\codex\ChatTrail`.

## Test Notes

The first implementation uses platform-specific selectors plus heuristic DOM detection. If the Doubao page structure differs in your account, the timeline may show too many or too few nodes. In that case, open DevTools on the chat page and send the outer HTML of one user message and one assistant message so the adapter can be tightened.
