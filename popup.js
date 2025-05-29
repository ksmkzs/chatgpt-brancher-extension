document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const openChatGPTBtn = document.getElementById('open-chatgpt');
    const helpBtn = document.getElementById('help');

    // 現在のタブがChatGPTかどうかを確認
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url && currentTab.url.includes('chatgpt.com')) {
            statusElement.className = 'status active';
            statusText.textContent = '拡張機能が動作中です';
        } else {
            statusElement.className = 'status inactive';
            statusText.textContent = 'ChatGPT.comで動作します';
        }
    });

    // ChatGPTを開くボタン
    openChatGPTBtn.addEventListener('click', function() {
        chrome.tabs.create({url: 'https://chatgpt.com'});
        window.close();
    });

    // ヘルプボタン
    helpBtn.addEventListener('click', function() {
        const helpText = `
ChatGPT Brancherの使い方:

1. 🌳 ツリー表示
   - ChatGPT.comにアクセスすると、画面右上に会話ツリーが表示されます
   - 青いノードはユーザーメッセージ、灰色は中間ノード（アシスタントメッセージ群）です

2. 🔄 ブランチ選択
   - ノードをクリックすると、そのブランチの会話のみが表示されます
   - 選択されたノードは赤色で表示されます
   - 再度クリックすると選択解除され、全ての会話が表示されます

3. 👁️ プレビュー機能
   - ノードにマウスを載せると、メッセージの冒頭部分がプレビュー表示されます

4. 🎯 中間ノード選択
   - 灰色のノード（アシスタントメッセージ）も選択できます
   - 選択すると該当の会話位置にスクロールします

5. 💬 チャット入力
   - ノードを選択中は、チャット入力欄が赤い枠で表示されます
   - この状態で送信すると、選択したブランチから続けて会話できます

ツリーパネルにマウスを載せると操作可能になります。

        `;
        

        alert(helpText.trim());
    });
});
