// ==UserScript==
// @name         ChatGPT Brancher v0.13
// @namespace    https://example.com/
// @version      0.13
// @description  ▸ userノード選択可 ▸ 1問1答ツリー (メッセージフィルタリング機能はコメントアウト) ▸ UI改善
// @match        https://chatgpt.com/*
// @require      https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js
// @grant        none
// ==/UserScript==

(function () {
/* ========== 1. storage utils ========== */
const P='cgpt_tree_', S='cgpt_sel_';
const kT=c=>P+c, kS=c=>S+c;
const cid=_=>location.pathname.match(/\/c\/([^/?#]+)/)?.[1];
const g=(k)=>{
    const item = localStorage.getItem(k);
    if (item === null || item === '') return {};
    try {
        return JSON.parse(item);
    } catch (e) {
        console.error(`[Brancher] Error parsing localStorage item ${k}:`, e, 'Raw item:', item);
        return {};
    }
};
const s=(k,o)=>{
    if (k === null || typeof k === 'undefined' || String(k).includes('undefined')) {
        return;
    }
    try {
        localStorage.setItem(k,JSON.stringify(o));
    } catch (e) {
        console.error('[Brancher] Error saving to localStorage:', e, 'Key:', k, 'Object:', o);
    }
};
const gT=c=>g(kT(c)), sT=(c,o)=>s(kT(c),o), mT=(c,p)=>sT(c,{...gT(c),...p});
const gSel=c=>localStorage.getItem(kS(c)), sSel=(c,id)=>id?localStorage.setItem(kS(c),id):localStorage.removeItem(kS(c));

window.tree=(c=cid())=>gT(c);
/* ========== 新しいメッセージフィルタリング戦略 ========== */

const MESSAGE_TURN_SELECTOR = 'articlee[data-testid^="conversation-turn-"]'; // 会話の各ターンを囲む要素のセレクタ (要確認)
const USER_MESSAGE_BLOCK_SELECTOR = 'div[data-message-author-role="user"]';

const PAGINATION_BUTTON_SELECTOR_PREV = 'button[aria-label*="Previous response"], button[aria-label*="前の回答"]'; // (要確認)
const PAGINATION_BUTTON_SELECTOR_NEXT = 'button[aria-label*="Next response"], button[aria-label*="次の回答"]';   // (要確認)
const PAGINATION_TEXT_SELECTOR = 'form div > span'; // 例: "1 / 2" のようなテキスト (要確認)

function showAllMessages() {
    document.querySelectorAll(MESSAGE_TURN_SELECTOR).forEach(turn => {
        turn.style.display = '';
    });
}

/**
 * 指定されたIDのノードからルート（"client-created-root"の直前）まで遡り、
 * 各ノードのidx値を収集して配列として返す。
 * 配列の順序はルート側から指定IDのノード側へ。
 *
 * @param {object} ms - addTurnAndIdxToMessages で処理済みのメッセージデータオブジェクト。
 *                      各メッセージは { parent: string|null, role: string, ..., idx: number, turn: number }
 *                      という形式を期待します。
 * @param {string} clickedElementId - パスの終点となるメッセージのID。
 * @returns {number[]} ルートから指定ノードまでのパス上の各ノードのidx値の配列。
 *                     指定IDが見つからない場合やエラー時は空配列を返すことがあります。
 */
function getpathtonode(ms, clickedElementId) {
  const pathIndices = [];
  let currentId = clickedElementId;
  const rootNodeId = "client-created-root"; // 会話データ構造上のルートを示すID

  let safetyCount = 0;
  const maxDepth = 100; // 無限ループや極端に深いパスに対する安全策

  // 1. まず、クリックされた要素のIDが ms データ内に存在するかを確認
  if (!ms || typeof ms !== 'object' || !ms[clickedElementId]) {
    console.error(`getpathtonode: Clicked element ID "${clickedElementId}" not found in ms data, or ms data is invalid.`);
    return []; // 対象が見つからない場合は空のパスを返す
  }

  // 2. clickedElementId から親を遡ってパスを構築
  while (currentId && currentId !== rootNodeId && safetyCount < maxDepth) {
    const currentNode = ms[currentId];

    if (!currentNode) {
      // currentId が ms データに存在しない場合 (clickedElementId の存在は確認済みなので、これは親IDが存在しないケース)
      console.warn(`getpathtonode: Node with ID "${currentId}" (parent of a previous node) not found in ms data while tracing path for "${clickedElementId}".`);
      break; // パス構築を中断
    }
    if (currentNode.role != 'user' && ms[currentNode.parent].role != 'user'){
        continue
    }

    // currentNode.idx は addTurnAndIdxToMessages によって数値として設定されているはず
    if (typeof currentNode.idx === 'number') {
      pathIndices.unshift(currentNode.idx); // パスの先頭に追加 (逆順にたどるので、結果的にルートからの順序になる)
    } else {
      // このケースは、ms データが期待通りに addTurnAndIdxToMessages で処理されていない場合に発生しうる
      console.warn(`getpathtonode: Node "${currentId}" is missing 'idx' property or it's not a number. Using 0 as a fallback. idx value:`, currentNode.idx);
      pathIndices.unshift(0); // フォールバックとして0を追加
    }

    if (!currentNode.parent) {
      // currentId が rootNodeId でないにも関わらず parent が null の場合、
      // それが実質的な会話ツリーのルートなので、ここで遡行を終了
      break;
    }
    currentId = currentNode.parent;
    safetyCount++;
  }

  if (safetyCount >= maxDepth) {
    console.warn(`getpathtonode: Path reconstruction for ID "${clickedElementId}" reached maximum depth (${maxDepth}). The path might be incomplete.`);
  }

  return pathIndices;
}



// UI更新を待つためのヘルパー関数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// メインの処理関数
async function processConversationTurns(clickedElementId) {
  // console.log(`Processing for clicked element ID: ${clickedElementId}`);
  const ms = addTurnAndIdxToMessages(gT(cid()));
  // 1. getpathtonode関数を実行
  const filteredPath = getpathtonode(ms, clickedElementId);
  // console.log('filteredPath:', filteredPath);

  if (!Array.isArray(filteredPath) || !filteredPath.every(num => Number.isInteger(num))) {
    console.error('filteredPath is not a valid array of integers.');
    return;
  }

  // 2. すべてのarticle[data-test-id^="conversation-turn-"]要素を非表示にする
  //    ^= を使用して "conversation-turn-" で始まるものを対象にします
  const allTurnArticles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
  allTurnArticles.forEach(article => {
    article.style.display = 'none';
  });
  // console.log('All turn articles hidden.');

  // 3. filteredPathを基に処理
  for (let i = 0; i < filteredPath.length; i++) {
    const turnNumber = i + 1; // ターン番号は1から始まる
    const targetValueForTurn = filteredPath[i]; // filteredPathのi番目の要素の値

    const articleSelector = `article[data-testid="conversation-turn-${turnNumber}"]`;
    const currentArticle = document.querySelector(articleSelector);

    if (!currentArticle) {
      console.warn(`Article not found for turn: ${turnNumber} (selector: ${articleSelector})`);
      continue; // このターンの処理をスキップ
    }

    // console.log(`Processing Turn ${turnNumber}, target value: ${targetValueForTurn}`);

    // ① xxが奇数の場合 (turnNumber が奇数)
    if (turnNumber % 2 !== 0) {
      // console.log(`Turn ${turnNumber} is ODD.`);
      // 0のときは、要素を表示状態にする (この処理は共通なので、後述の表示処理で行う)
      // 0でないときは、さらに処理を行う
      if (targetValueForTurn !== 0) {
        currentArticle.style.display = ''; // まず表示
        // console.log(`Displaying ${articleSelector}`);

        const tabulerNumsDiv = currentArticle.querySelector('div[class="tabuler-nums"]');
        const prevButton = currentArticle.querySelector('button[aria-label="前の回答"]');
        const nextButton = currentArticle.querySelector('button[aria-label="次の回答"]');

        if (!tabulerNumsDiv) {
          console.warn(`div.tabuler-nums not found in ${articleSelector}`);
          // 0でないのに tabuler-nums がない場合、比較とクリック操作はできない
          // 記事は表示されたままになる
          continue;
        }
        if (!prevButton || !nextButton) {
            console.warn(`Navigation buttons not found in ${articleSelector}. Cannot adjust value.`);
            // ボタンがない場合、調整不可
            continue;
        }


        let attempts = 0;
        const maxAttempts = 20; // 無限ループ防止

        // filteredPath[xx] = 整数A になるまでクリック
        while (attempts < maxAttempts) {
          // 現在の整数Aを取得
          const numText = tabulerNumsDiv.textContent.trim(); // "整数A/整数B"
          const match = numText.match(/^(\d+)\s*\/\s*\d+$/);
          if (!match) {
            console.error(`Could not parse number from div.tabuler-nums in ${articleSelector}. Text: "${numText}"`);
            break; // パース失敗
          }
          let currentIntegerA = parseInt(match[1], 10);
          // console.log(`Turn ${turnNumber}: current A = ${currentIntegerA}, target = ${targetValueForTurn}`);

          if (currentIntegerA === targetValueForTurn) {
            // console.log(`Turn ${turnNumber}: Target value ${targetValueForTurn} reached.`);
            break; //目標値に到達
          }

          if (targetValueForTurn < currentIntegerA) {
            // console.log(`Turn ${turnNumber}: Clicking "前の回答" (target: ${targetValueForTurn}, current: ${currentIntegerA})`);
            prevButton.click();
          } else { // targetValueForTurn > currentIntegerA
            // console.log(`Turn ${turnNumber}: Clicking "次の回答" (target: ${targetValueForTurn}, current: ${currentIntegerA})`);
            nextButton.click();
          }

          // クリック後、DOMの更新と値の再取得のために少し待つ
          // この遅延は実際のUIの応答速度に合わせて調整が必要
          await delay(500); // 0.5秒待機
          attempts++;
        }

        if (attempts >= maxAttempts) {
          console.warn(`Turn ${turnNumber}: Max attempts reached. Could not set to target value ${targetValueForTurn}.`);
        }
      } else { // targetValueForTurn === 0 の場合 (奇数ターン)
        currentArticle.style.display = ''; // 表示状態にするだけ
        // console.log(`Displaying ${articleSelector} (target value is 0).`);
      }
    }
    // ② xxが偶数の場合 (turnNumber が偶数)
    else {
      // console.log(`Turn ${turnNumber} is EVEN.`);
      currentArticle.style.display = ''; // 表示状態にするだけ
      // console.log(`Displaying ${articleSelector}`);
    }
  }
  // console.log('Processing finished.');
}
/* ========== 2. fetch hook (MODIFIED) ========== */

function addTurnAndIdxToMessages(msData) {
    // 1. 元データをディープコピーして、IDをキーとするmessageMapを作成
    //    同時に、各メッセージオブジェクトに自身のIDを'id'プロパティとして追加
    const messageMap = {};
    for (const id in msData) {
        messageMap[id] = { ...msData[id], id: id, turn: null, idx: 0 }; // turnとidxを初期化
    }

    // 2. 親子関係マップ (childrenMap) を構築
    //    childrenMapの各エントリのキーは親ID、値はその親IDを持つ子IDの配列
    //    子IDの配列は create_time でソート（nullが最も古い）
    const childrenMap = {};
    for (const id in messageMap) {
        const msg = messageMap[id];
        if (msg.parent) {
            if (!childrenMap[msg.parent]) {
                childrenMap[msg.parent] = [];
            }
            childrenMap[msg.parent].push(id);
        }
    }

    for (const parentId in childrenMap) {
        childrenMap[parentId].sort((aId, bId) => {
            const aTime = messageMap[aId].create_time;
            const bTime = messageMap[bId].create_time;
            if (aTime === null && bTime === null) return 0;
            if (aTime === null) return -1; // null は最も古いとみなす
            if (bTime === null) return 1;
            return aTime - bTime;
        });
    }

    // 3. idx を計算して付与
    for (const id in messageMap) {
        const msg = messageMap[id];
        if (msg.role === "user") {
            const parentId = msg.parent;
            if (parentId && childrenMap[parentId]) {
                const siblingUserMessages = childrenMap[parentId]
                    .map(siblingId => messageMap[siblingId])
                    .filter(sibling => sibling.role === "user");

                if (siblingUserMessages.length > 1) {
                    // childrenMap[parentId] は既に create_time でソート済みなので、
                    // siblingUserMessages もその順序を保持している
                    const indexInSiblings = siblingUserMessages.findIndex(sibling => sibling.id === msg.id);
                    if (indexInSiblings !== -1) {
                        msg.idx = indexInSiblings + 1;
                    }
                } else {
                    msg.idx = 0; // 唯一のuserメッセージ、またはuserメッセージでない場合はデフォルトの0のまま
                }
            } else {
                 msg.idx = 0; // 親がいないか、親に子がいない場合 (通常は発生しないが念のため)
            }
        } else {
            msg.idx = 0; // userロールでない場合は0
        }
    }

    // 4. turn を計算して付与 (再帰関数を使用)
    const assignTurnsRecursively = (nodeId, nextExpectedUserTurn) => {
        const node = messageMap[nodeId];

        // ノードが存在しないか、既にturnが割り当てられていればスキップ
        if (!node || node.turn !== null) {
            return;
        }

        if (node.role === "user") {
            node.turn = nextExpectedUserTurn;
            const children = childrenMap[nodeId] || [];
            for (const childId of children) {
                // 次のユーザーメッセージのターンは現在のユーザーターン + 2
                assignTurnsRecursively(childId, nextExpectedUserTurn + 2);
            }
        } else { // assistant, system, etc.
            // 非ユーザーメッセージのターンは、次に期待されるユーザーターン - 1
            // これにより、最初のユーザー(turn=1)より前のメッセージ(systemなど)はturn=0になる
            node.turn = nextExpectedUserTurn - 1;
            const children = childrenMap[nodeId] || [];
            for (const childId of children) {
                // アシスタントやシステムが連続する場合、次に期待されるユーザーターン番号は変わらない
                assignTurnsRecursively(childId, nextExpectedUserTurn);
            }
        }
    };

    // 会話の開始点 (通常は "client-created-root" の子) からturn割り当てを開始
    // "client-created-root" の子は create_time でソートされていると仮定 (childrenMap構築時にソート済)
    const initialMessageContainerId = "client-created-root";
    if (childrenMap[initialMessageContainerId]) {
        for (const rootChildId of childrenMap[initialMessageContainerId]) {
            // 各ルート直下の子から始まる会話の連鎖に対して、最初のユーザーターンを1として再帰処理を開始
            // 既に処理済みのノードは assignTurnsRecursively 内のチェックでスキップされる
             if (messageMap[rootChildId] && messageMap[rootChildId].turn === null) {
                assignTurnsRecursively(rootChildId, 1);
             }
        }
    }

    // 5. 結果を元のmsDataの形式に整形して返す
    //    messageMap には id, turn, idx が追加されているので、これを msData の各エントリに反映
    const resultData = {};
    for (const id in msData) {
        if (messageMap[id]) { // client-created-root のような特殊なキーは messageMap にはない場合がある
            resultData[id] = {
                parent: messageMap[id].parent,
                role: messageMap[id].role,
                create_time: messageMap[id].create_time,
                idx: messageMap[id].idx,
                turn: messageMap[id].turn
            };
        } else { // messageMap に含まれなかったキー (例: client-created-root 自体)
            resultData[id] = { ...msData[id] }; // 元の値をそのままコピー
        }
    }

    return resultData;
}
const origFetch = window.fetch;
window.fetch = async (input, init) => {
    const url = (typeof input === 'string') ? input : input.url;
    const conf = { ...(init || {}) };
    const isConv = typeof url === 'string' && url.includes('/backend-api/conversation');

    if (!isConv) return origFetch(input, conf);

    let reqBodyObj = {};
    if (conf.body) {
        try { reqBodyObj = JSON.parse(conf.body); } catch (e) { /*ignore*/ }
    }

    const C = reqBodyObj.conversation_id || cid();

    if (C && reqBodyObj.messages?.[0]) {
        const u = reqBodyObj.messages[0];
        mT(C, {[u.id]: {
            parent: reqBodyObj.parent_message_id || null,
            role: 'user',
            create_time: u.create_time || (Date.now() / 1000)
        }});
    }

    if (C && reqBodyObj.action === 'next') {
        const selectedMessageId = gSel(C);
        if (selectedMessageId) {
            const conversationTree = gT(C);
            const selectedNodeDetails = conversationTree[selectedMessageId];
            if (selectedNodeDetails && selectedNodeDetails.role === 'user') {
                 reqBodyObj.parent_message_id = selectedNodeDetails.parent;
                 conf.body = JSON.stringify(reqBodyObj);
            }
        }
    }

    const response = await origFetch(input, conf);
    const clonedResponse = response.clone();
    const contentType = clonedResponse.headers.get('content-type') || '';

    const saveAssistant = (msgId, parentUser, msgCreateTime) => {
        if (C) {
            mT(C, {[msgId]: {parent: parentUser, role: 'assistant', create_time: msgCreateTime}});
            draw();
        }
    };

    if (contentType.startsWith('text/event-stream')) {
        clonedResponse.text().then(text => {
            const lines = text.split('\n');
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    const jsonData = line.substring(6);
                    if (jsonData.trim() === '[DONE]') return;
                    try {
                        const obj = JSON.parse(jsonData);
                        const msg = obj.message || obj;
                        if (msg && msg.id && msg.author?.role === 'assistant') {
                            const parentUserId = reqBodyObj.messages?.[0]?.id || reqBodyObj.parent_message_id;
                            if (parentUserId) {
                                saveAssistant(msg.id, parentUserId, msg.create_time || (Date.now()/1000));
                            }
                        }
                    } catch (e) { /*ignore*/ }
                }
            });
        }).catch(err => console.error('[Brancher] Error processing stream:', err));
    } else if (contentType.startsWith('application/json')) {
        clonedResponse.json().then(jsonResponse => {
            if (!jsonResponse.mapping) return;
            if (!C) return;
            const patch = {};
            for (const nodeId in jsonResponse.mapping) {
                const n = jsonResponse.mapping[nodeId];
                if (!n || !n.id) continue;
                const messageData = n.message || {};
                const role = messageData.author?.role || n.role || null;
                const text = messageData.content?.parts?.[0] || '';
                const createTime = messageData.create_time || n.create_time || null;
                patch[n.id] = {
                    parent: n.parent || null,
                    role: role,

                    create_time: createTime
                };
            }
            if (Object.keys(patch).length > 0) {
                mT(C, patch);
                draw();
            }
        }).catch(err => console.error('[Brancher] Error processing JSON response:', err));
    }
    return response;
};

/* ========== 3. buildCondensed() ========== */
// ... (変更なし) ...
function buildCondensed (nodes) {
  if (!nodes || nodes.length === 0) return null;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const childrenOf = {};
  nodes.forEach(n => {
    if (n && n.parent) {
        (childrenOf[n.parent] || (childrenOf[n.parent] = [])).push(n.id);
    }
  });
  const users = nodes.filter(n => n && n.role === 'user');
  if (users.length === 0) return null;
  let rootUser = users.find(u => {
    if (!u.parent) return true;
    let p = u.parent;
    let ancestorIsUser = false;
    const visitedParents = new Set();
    while (p && byId.get(p) && !visitedParents.has(p)) {
        visitedParents.add(p);
        if (byId.get(p).role === 'user') {
            ancestorIsUser = true;
            break;
        }
        p = byId.get(p).parent;
    }
    return !ancestorIsUser;
  }) || users.sort((a,b) => (byId.get(a.id).create_time || 0) - (byId.get(b.id).create_time || 0))[0];
  if (!rootUser) return null;
  const seen = new Set();
  function walkUser (id) {
    if (!id || !byId.get(id) || byId.get(id).role !== 'user') return null;
    if (seen.has(id)) return null;
    seen.add(id);
    const out  = { id, children: [], placeholder: false, data: byId.get(id) };
    const dirs = childrenOf[id] || [];
    const directUser = dirs.filter(c => byId.get(c)?.role === 'user');
    const nonUser    = dirs.filter(c => byId.get(c)?.role !== 'user');
    directUser.forEach(uId => {
      const child = walkUser(uId);
      if (child) out.children.push(child);
    });
    if (nonUser.length) {
      const gray = { id: 'g-' + id, children: [], placeholder: true, data: {role:'placeholder'} };
      const q = [...nonUser], visit = new Set(q);
      while (q.length) {
        const cur = q.shift();
        if (byId.get(cur)?.role === 'user') {
          const child = walkUser(cur);
          if (child) gray.children.push(child);
        } else {
          (childrenOf[cur] || []).forEach(grandKid => {
            if(!visit.has(grandKid)){
                 q.push(grandKid);
                 visit.add(grandKid);
            }
          });
        }
      }
      if(gray.children.length > 0 || nonUser.some(nu => byId.get(nu)?.role === 'assistant') ){
           out.children.push(gray);
      }
    }
    if(out.children.length === 1 && out.children[0].placeholder && out.children[0].children.length ===0){
        if(!nonUser.some(nuId => byId.get(nuId)?.role === 'assistant')){
        }
    }
    return out;
  }
  const hierarchyData = walkUser(rootUser.id);
  if (!hierarchyData) return null;
  return d3.hierarchy(hierarchyData, d => d.children);
}

/* ========= 0. 共通: テーマ判定ヘルパ ========= */
const isDark = () => document.documentElement.classList.contains('dark');

/* ========== 4. UI panel ========== */
const OPACITY_IDLE = 0.2, OPACITY_HOVER = 1.0;
const pane = document.createElement('div');
Object.assign(pane.style, {
  position: 'fixed', top: '8px', right: '8px',
  width: '420px', height: '540px', // これらは uiMetrics で動的に設定される
  background: 'transparent',
  pointerEvents: 'none', // pane自体はイベントを拾わない
  zIndex: 9999,
});
document.body.appendChild(pane);

const miniWrap = document.createElement('div');
Object.assign(miniWrap.style, {
  position: 'absolute', // right, bottom, width, height は uiMetrics で設定
  opacity: '0', // 初期は透明
  transition: 'opacity 0.15s',
  pointerEvents: 'none', // 初期はイベントを拾わない
  background: 'transparent', // miniWrap 自体の背景も透明に
});
pane.appendChild(miniWrap);



const miniSvg = d3.select(miniWrap).append('svg')
                  .style('width', '100%') // attrではなくstyleで相対指定
                  .style('height', '100%')
                  .style('background', isDark() ? '#222' : '#f5f5f5'); // miniSvg自体は背景色を持つ
const miniG   = miniSvg.append('g');


const scroll = document.createElement('div');
Object.assign(scroll.style, {
  position: 'absolute', inset: '0',
  overflowX: 'hidden', overflowY: 'hidden',
  pointerEvents: 'none', // スクロールバー操作と、中の要素へのイベント伝達のため
  background: 'transparent', // 背景を透明に
});
pane.appendChild(scroll);

const svg  = d3.select(scroll).append('svg')
    .style('background', 'transparent') // SVG背景も透明に
    .style('pointer-events', 'none'); // svg自体はイベントを拾わない
const gSvg = svg.append('g')
　　.style('pointer-events', 'auto'); // gSvg でイベントを拾うように変更 (中の要素で更に制御)

// pane のホバーで scroll と miniWrap の表示/操作性を制御
let isPaneHovered = false;
let isPointerOverTreeElements = false; // draw関数内でも参照するため、スコープを上げる
let isPointerOverMinimap = false;    // 同上
pane.addEventListener('mouseenter', () => {
    isPaneHovered = true;
    scroll.style.overflowX = 'auto';
    scroll.style.overflowY = 'auto';
    scroll.style.pointerEvents = 'auto'; // pane に乗ったら scroll は常にイベントを受け付ける

    // miniWrap の表示 (pointerEvents は miniWrap のホバーで制御)
    miniWrap.style.opacity = OPACITY_HOVER; // pane に乗ったらミニマップは基本表示
});

pane.addEventListener('mouseleave', () => {
    isPaneHovered = false;
    // マウスが要素上 (node, edge, miniWrap) にない場合のみ非表示にする遅延チェック
    setTimeout(() => {
        if (!isPaneHovered && !isPointerOverTreeElements && !isPointerOverMinimap) {
            scroll.style.overflowX = 'hidden';
            scroll.style.overflowY = 'hidden';
            scroll.style.pointerEvents = 'none';
            miniWrap.style.opacity = '0';
            miniWrap.style.zIndex = '0';
            miniWrap.style.pointerEvents = 'none';
        }
    }, 100); // 少し遅延させて、他の要素への移動を許容
});

// miniWrap のホバーで pointerEvents を制御 (クリック透過のため)
miniWrap.addEventListener('mouseenter', () => {
    isPointerOverMinimap = true;
    miniWrap.style.pointerEvents = 'auto';
});
miniWrap.addEventListener('mouseleave', () => {
    isPointerOverMinimap = false;
    miniWrap.style.pointerEvents = 'none'; // miniWrap から離れたらイベント透過
    // paneがホバーされていれば opacity は維持される
});


/* ========= 1. 可変レイアウト定数 ========= */
function uiMetrics () {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const paneW = Math.max(300, vw / 3.5);
  const paneH = Math.max(200, vh * 0.6);
  const paneRight = Math.max(8, vw * 0.02);
  const paneTop   = Math.max(8, vh * 0.05);
  const base   = Math.min(paneW, paneH);
  const radius = Math.max(4, base / 70);
  const gapX   = radius * 5;
  const gapY   = radius * 7;

  const miniMapScaleFactor = 0.4; // paneの短辺に対するミニマップのサイズ比率
  const miniMapSize = Math.max(60, base * miniMapScaleFactor);
  const miniMapMargin = Math.max(4, paneW * 0.015); // paneの幅に対するマージン比率

  return {
    radius, gapX, gapY,
    edgeStroke: Math.max(1, radius / 15),
    paneW, paneH, paneRight, paneTop,
    miniMapSize, miniMapMargin // ミニマップ用の値を返す
  };
}

/* ========= ミニマップ描画関数 ========= */
// ... (updateMinimap 関数は変更なし) ...
function updateMinimap(h, metrics, sel, scrollElement, paneElement, gSvgContext) {
    const { radius, edgeStroke } = metrics;
    const { treeW_calc, treeH_calc, minX_calc, minY_calc, fullH_calc, paneW_calc, paneH_calc } = gSvgContext;

    miniSvg.style('background', isDark() ? '#222' : '#f5f5f5');
    const descendants = h.descendants();
    if (descendants.length === 0) {
        miniG.selectAll("*").remove();
        return;
    }

    const totalTreeWidth = treeW_calc + (radius + edgeStroke) * 2;
    const totalTreeHeight = treeH_calc + (radius + edgeStroke) * 2;
    const vbX = (isFinite(minX_calc) ? minX_calc : 0) - radius - edgeStroke;
    const vbY = (isFinite(minY_calc) ? minY_calc : 0) - radius - edgeStroke;
    const vbW = isFinite(totalTreeWidth) && totalTreeWidth > 0 ? totalTreeWidth : 120;
    const vbH = isFinite(totalTreeHeight) && totalTreeHeight > 0 ? totalTreeHeight : 120;
    miniSvg.attr('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);

    const mEdgeCol = isDark() ? '#666' : '#999';
    const mEdgeSel = miniG.selectAll('line.mEdge').data(h.links(), d => `${d.source.data.id}-${d.target.data.id}`);
    mEdgeSel.enter().append('line').attr('class', 'mEdge')
        .merge(mEdgeSel)
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
        .attr('stroke', mEdgeCol).attr('stroke-width', Math.max(0.5, edgeStroke / 2))
        .attr('pointer-events', 'none');
    mEdgeSel.exit().remove();

    const mNodeSel = miniG.selectAll('circle.mNode').data(descendants, d => d.data.id);
    mNodeSel.enter().append('circle').attr('class', 'mNode')
        .merge(mNodeSel)
        .attr('cx', d => d.x).attr('cy', d => d.y)
        .attr('r', radius * 0.6)
        .attr('fill', d => {
            if (d.data.placeholder) return '#bbb';
            return (d.depth === 0 ? '#777' : (d.data.id === sel ? '#dc3545' : '#0d6efd'));
        })
        .attr('pointer-events', 'auto');
    mNodeSel.exit().remove();

    const viewX = scrollElement.scrollLeft, viewY = scrollElement.scrollTop;
    const viewW = scrollElement.clientWidth, viewH = scrollElement.clientHeight;

    miniG.selectAll('rect.view').data([null]).join('rect').attr('class', 'view')
        .attr('x', vbX + (viewX / paneW_calc) * vbW)
        .attr('y', vbY + (viewY / Math.max(paneH_calc, fullH_calc)) * vbH)
        .attr('width', (viewW / paneW_calc) * vbW)
        .attr('height', (viewH / Math.max(paneH_calc, fullH_calc)) * vbH)
        .attr('fill', 'rgba(52,152,219,0.15)').attr('stroke', '#3498db')
        .attr('stroke-width', Math.max(0.3, edgeStroke / 3));
}

/* ========== チャット入力欄 スタイル制御 ========= */
const PROMPT_TEXTAREA_ID = 'prompt-textarea'; // textarea特定用
const TARGET_DIV_CLASSES = ['relative', 'flex', 'w-full', 'items-end', 'px-3', 'py-3']; // ターゲットdivのクラス群

function styleChatInput(selected) {
    const textarea = document.getElementById(PROMPT_TEXTAREA_ID);
    if (textarea) {
        // textarea から親をたどって、指定されたクラスを全て持つ div を探す
        let targetDiv = textarea.parentElement;
        while (targetDiv && targetDiv.tagName !== 'BODY') {
            const classList = targetDiv.classList;
            if (TARGET_DIV_CLASSES.every(cls => classList.contains(cls))) {
                // マッチするdivが見つかった
                break;
            }
            targetDiv = targetDiv.parentElement;
        }

        if (targetDiv && targetDiv.tagName !== 'BODY') { // 見つかった場合
            if (selected) {
                targetDiv.style.border = '2px solid red';
                targetDiv.style.borderRadius = '2rem'; // 角を少し丸める (オプション)
            } else {
                targetDiv.style.border = '';
                targetDiv.style.borderRadius = '';
                targetDiv.style.boxSizing = '';
            }
        } else {
            // console.warn("[Brancher] Target div for chat input styling not found.");
            // フォールバックとしてtextarea自体を対象にするか、何もしない
            // ここでは何もしない
        }
    }
}
/* ========= draw() (MODIFIED) ========= */

function draw () {
    const C = cid();
    if (!C) {
        gSvg.selectAll("*").remove(); miniG.selectAll("*").remove();
        return;
    }

    const metrics = uiMetrics();
    const { radius, gapX, gapY, edgeStroke, paneW, paneH, paneRight, paneTop, miniMapSize, miniMapMargin } = metrics;

    // pane と miniWrap のスタイルを metrics に基づいて更新
    pane.style.top = `${paneTop}px`; pane.style.right = `${paneRight}px`;
    pane.style.width = `${paneW}px`; pane.style.height = `${paneH}px`;

    miniWrap.style.width = `${miniMapSize}px`;
    miniWrap.style.height = `${miniMapSize}px`;
    miniWrap.style.right = `${miniMapMargin}px`;
    miniWrap.style.bottom = `${miniMapMargin}px`;

    const conversationData = gT(C);
    if (!conversationData || Object.keys(conversationData).length === 0) {
        gSvg.selectAll("*").remove(); miniG.selectAll("*").remove();
        return;
    }
    const nodes = Object.entries(conversationData).map(([id, o]) => ({
        id, parent: o.parent, role: o.role, create_time: o.create_time
    }));

    const h = buildCondensed(nodes);
    if (!h) {
        gSvg.selectAll("*").remove(); miniG.selectAll("*").remove();
        return;
    }

    d3.tree().nodeSize([gapX, gapY])(h);
    svg.attr('width', paneW);

    const descendants = h.descendants();
    if (descendants.length === 0) {
        gSvg.selectAll("*").remove(); miniG.selectAll("*").remove(); return;
    }

    const xs = descendants.map(d => d.x); const ys = descendants.map(d => d.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const treeW_calc = maxX - minX, treeH_calc = maxY - minY;
    const offsetX = (paneW - treeW_calc) / 2 - minX + radius;
    const offsetY = radius + 10;
    const fullH_calc = treeH_calc + offsetY * 2;
    svg.attr('height', Math.max(paneH, fullH_calc));

    gSvg.attr('transform', `translate(${offsetX}, ${offsetY})`)
        .style('opacity', isPointerOverTreeElements || isPaneHovered ? OPACITY_HOVER : OPACITY_IDLE);
    const edgeColor = isDark() ? '#aaa' : '#555';
    const edgeSelection = gSvg.selectAll('line.edge').data(h.links(), d => `${d.source.data.id}-${d.target.data.id}`);
    edgeSelection.enter().insert('line', ':first-child').attr('class', 'edge')
        .merge(edgeSelection)
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
        .attr('stroke', edgeColor).attr('stroke-width', edgeStroke)
        .style('pointer-events', 'stroke') // 線はホバーイベントを拾う (クリックはしない)
        .on('mouseenter', function() {
            isPointerOverTreeElements = true;
            gSvg.style('opacity', OPACITY_HOVER);
        })
        .on('mouseleave', function() {
           setTimeout(() => { if (!document.querySelector("g.node:hover, line.edge:hover")) isPointerOverTreeElements = false;}, 0);
        });
    edgeSelection.exit().remove();

    let sel = gSel(C);
    styleChatInput(!!sel);
    if (h.data && sel && sel === h.data.id && descendants.length === 1 && !h.data.parent && conversationData[h.data.id]?.role === 'user') {
        sSel(C, null); sel = null;
    }

    const nodeSelection = gSvg.selectAll('g.node').data(descendants, d => d.data.id);
    const nodeEnter = nodeSelection.enter().append('g').attr('class', 'node');
    nodeEnter.append('circle');

    nodeSelection.merge(nodeEnter)
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .each(function (dNode) {
            const group = d3.select(this);
            const circle = group.select('circle')
                .attr('r', radius)
                .attr('stroke', isDark() ? '#333' : '#fff')
                .attr('stroke-width', radius * 0.15)
                .style('pointer-events', 'auto') // ノード(円)はイベントを拾う
                .on('mouseenter', function() {
                    isPointerOverTreeElements = true;
                    gSvg.style('opacity', OPACITY_HOVER);
                    scroll.style.pointerEvents = 'auto'; // ★重要
                })
                .on('mouseleave', function() {
                    isPointerOverTreeElements = false;
                    gSvg.style('opacity', OPACITY_IDLE);
                    // 他のノードや線にすぐに移る場合があるので、ここではscrollのpointer-eventsをnoneにしない
                    // paneのmouseleaveで最終的に制御される
                });

            const isPl = dNode.data.placeholder;
            const isRoot = dNode.depth === 0 && !isPl;
            const isSel = !isPl && dNode.data.id === sel;

            if (isPl) {
                circle.attr('fill', '#b0b0b0')
                    .style('cursor', 'default')
                    .on('click', null);
            } else {
                circle.attr('fill', isRoot ? '#777' : (isSel ? '#dc3545' : '#0d6efd'))
                    .style('cursor', isRoot ? 'default' : 'pointer')
                    .on('click', isRoot ? null : (event) => { // ★ async に戻す
                        event.stopPropagation();
                        const C_local = cid(); if (!C_local) return;
                        const clickedNodeId = dNode.data.id; // dNode.data.id は凝縮ツリーのID (元メッセージのID)

                        if (gSel(C_local) === clickedNodeId) { // Deselect
                            sSel(C_local, null);
                            showAllMessages(); // 全メッセージ表示
                            styleChatInput(false); // チャット欄の枠を消す
                        } else { // Select
                             sSel(C_local, clickedNodeId);
                            processConversationTurns(clickedNodeId);
                        }
                        draw(); // ツリーの選択色などを再描画

                    });
            }
        });
    nodeSelection.exit().remove();

    const gSvgRenderContext = {
        treeW_calc: treeW_calc, treeH_calc: treeH_calc,
        minX_calc: minX, minY_calc: minY,
        fullH_calc: fullH_calc,
        paneW_calc: paneW, paneH_calc: paneH
    };
    updateMinimap(h, metrics, sel, scroll, pane, gSvgRenderContext);
}


/* ========= Event Listeners & Init ========= */
// ... (変更なし) ...
scroll.addEventListener('scroll', () => {
    // スクロール中はisPointerOverTreeElementsをtrueに保つ試み (効果は限定的かも)
    // isPointerOverTreeElements = true;
    requestAnimationFrame(draw);
});
window.addEventListener('resize', () => requestAnimationFrame(draw));
window.addEventListener('popstate', () => {
    setTimeout(() => {
        showAllMessages(); // ページ遷移時は全表示
        sSel(cid(), null); // 選択も解除
        styleChatInput(false);
        draw();
    }, 500);
});

const observerTargetNode = document.querySelector('main') || document.body;
if (observerTargetNode) {
    let debounceTimer;
    const debouncedDraw = () => {
        clearTimeout(debounceTimer);
        // DOM変更がメッセージフィルタリングに影響する場合があるので、選択状態に応じて再フィルタリングも考慮
        debounceTimer = setTimeout(async () => { // async に
            const C = cid();
            const selectedId = gSel(C);
            if (selectedId) {
                // DOM変更があった場合、選択中のブランチを再表示試行
                // ただし、これが編集中などに意図しない動作をする可能性もあるので注意
                //await processConversationTurns(selectedId);
            }
            requestAnimationFrame(draw);
        }, 350); // DOM変更が落ち着くのを待つため少し長め

    };
    const observer = new MutationObserver((mutationsList) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'attributes' || mutation.type === 'characterData') {
                 if (mutation.target.matches && (
                     mutation.target.matches('[data-message-id], [data-message-id] *, button[aria-label*="次"], button[aria-label*="前の回答"]') ||
                     mutation.target.parentElement?.closest('[data-message-id]')
                    )) {
                    debouncedDraw();
                    break;
                 } else if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    debouncedDraw();
                    break;
                 }
            }
        }
    });
    observer.observe(observerTargetNode, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['disabled', 'style', 'data-message-id', 'aria-label'],
      characterData: true
    });
}

setTimeout(draw, 1500);

if (window.matchMedia) {
    const themeChangeHandler = () => requestAnimationFrame(draw);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChangeHandler);
    const htmlObserver = new MutationObserver(themeChangeHandler);
    htmlObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

})();
