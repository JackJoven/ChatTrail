# ChatTrail

ChatTrail is a browser extension prototype for timeline navigation on AI chat platforms.

## Current Scope

- ChatGPT: `chatgpt.com`, `chat.openai.com`
- Doubao: `doubao.com`, `www.doubao.com`, `*.doubao.com`

## Timeline Navigation

- Right-side timeline nodes are generated from your visible user messages only.
- Click a node to jump to your message.
- Hover a node to preview your message.
- Press `j` / `k` to move to the next or previous user message when the chat input is not focused.

## Local Installation

1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Click "Load unpacked".
5. Select this folder: `C:\AI\codex\ChatTrail`.

## Test Notes

The first implementation uses platform-specific selectors plus heuristic DOM detection. If the Doubao page structure differs in your account, the timeline may show too many or too few nodes. In that case, open DevTools on the chat page and send the outer HTML of one user message and one assistant message so the adapter can be tightened.
