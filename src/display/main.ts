// 表示画面の受け口のみ（中身は display-dev 担当）。受信した DisplayPayload を確認用に出すだけ。
import { CHANNEL_NAME, type ChannelMessage } from '../shared/protocol';

const app = document.getElementById('app')!;
app.innerHTML = '<p id="st">操作画面からの送信待ち…</p><pre id="pre"></pre>';
const ch = new BroadcastChannel(CHANNEL_NAME);
ch.onmessage = (e: MessageEvent<ChannelMessage>) => {
  if (e.data.type !== 'state') return;
  document.getElementById('st')!.textContent = `受信: ${new Date(e.data.payload.at).toLocaleTimeString()}`;
  document.getElementById('pre')!.textContent = JSON.stringify(e.data.payload, null, 1);
};
ch.postMessage({ type: 'hello' } satisfies ChannelMessage); // 操作画面に最新状態の再送を要求
