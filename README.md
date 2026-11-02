# MIDI 工作台

隨機生成多軌 MIDI、在 Piano Roll 中編輯，並以 Tone.js 合成器 / 採樣器播放。直接用瀏覽器開啟 `index.html` 即可（需連網載入 Tone.js 與樣本）。

## 功能
- **🎲 隨機生成**：隨機調性（大調 / 小調 / Dorian）、BPM、和弦進行與配器風格，產生鼓組、貝斯、和弦、旋律（可能附琶音 / 鋪底）。
- **🎲 重生此軌**：沿用目前調性與和弦進行，只重生選取的音軌。
- **音色**：每軌可選「自動」或指定合成器 / 採樣器。
  - 自動：依「配器風格 × 音軌角色」挑選；匯入的 MIDI 依 GM 樂器家族對應。樣本載入失敗時自動改用合成器。
  - 合成器：Triangle、方波 Lead、FM 電鋼琴、AM 鐘聲、Fat Saw Pad、撥弦、Mono 貝斯、合成鼓組。
  - 電音 EDM：Supersaw Lead、Wobble Bass（LFO 同步節拍）、Acid 303、808 Sub、House Stab、Future Pluck、Chiptune。
  - 採樣器：Salamander 鋼琴、tonejs-instruments（電貝斯、尼龍吉他、小提琴、大提琴、長笛、小號、風琴、木琴）、Tone.js 鼓組樣本（原聲、CR-78、LinnDrum）。
- **+ 電音軌**：選擇電音角色後，依目前調性與和弦進行自動生成該軌（Acid 16 分音符線條、808 長音、反拍 Stab…），音色自動套用對應的 EDM 合成器。「電子」風格的隨機生成也會用到這些角色與音色。
- **MIDI 匯入 / 匯出**（@tonejs/midi）：channel 10 視為鼓組；匯出時寫入對應的 GM program。
- 混音：每軌音量、M（靜音）、S（獨奏）、主音量。
- 編輯狀態自動存在 localStorage。

## Piano Roll 操作
| 操作 | 說明 |
| --- | --- |
| 點擊空白 | 新增音符（長度依「音長」，可直接拖曳延長） |
| 拖曳音符 / 右緣 | 移動 / 調整長度 |
| 右鍵、Alt + 點擊、Delete | 刪除 |
| Shift + 拖曳空白 / Shift + 點擊 | 框選 / 加選 |
| 方向鍵（+Shift） | 移動 1 格 / 半音（4 格 / 八度） |
| 力度滑桿 | 設定新音符力度，或修改已選音符 |
| 點擊時間尺 | 移動播放位置 |
| 滾輪 / Shift+滾輪 / ⌘+滾輪 | 垂直 / 水平捲動 / 縮放 |
| Space、⌘Z、⌘⇧Z | 播放停止、復原、重做 |

## 檔案
- `js/instruments.js`：音色定義、自動配器規則、合成器 / 採樣器建立
- `js/generator.js`：隨機作曲
- `js/pianoroll.js`：Canvas Piano Roll
- `js/app.js`：狀態、播放排程、音軌 UI、MIDI 匯入匯出、Undo
