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
        console.warn('[Brancher] Invalid key for localStorage:', k);
        return;
    }
    try {
        localStorage.setItem(k,JSON.stringify(o));
        // // console.log('[Brancher] Saved to localStorage:', k, Object.keys(o).length, 'items');
        
        // 保存確認
        const verification = localStorage.getItem(k);
        if (verification) {
           // // console.log('[Brancher] localStorage save verified successfully');
        } else {
            console.error('[Brancher] localStorage save failed - item not found after save');
        }
    } catch (e) {
        console.error('[Brancher] Error saving to localStorage:', e, 'Key:', k, 'Object:', o);
    }
};
const gT=c=>g(kT(c)), sT=(c,o)=>s(kT(c),o), mT=(c,p)=>sT(c,{...gT(c),...p});
const gSel=c=>localStorage.getItem(kS(c)), sSel=(c,id)=>id?localStorage.setItem(kS(c),id):localStorage.removeItem(kS(c));

// preview機能用のストレージ
const gPreview=c=>localStorage.getItem(`cgpt_preview_${c}`), sPreview=(c,text)=>text?localStorage.setItem(`cgpt_preview_${c}`,text):localStorage.removeItem(`cgpt_preview_${c}`);

window.tree=(c=cid())=>gT(c);

// D3.jsはmanifest.jsonで読み込み済みなので直接初期化
function initializeBrancher() {
    if (!window.d3) {
        console.error('[Brancher] D3.js not loaded');
        return;
    }
    
    if (!document.body) {
        setTimeout(initializeBrancher, 100);
        return;
    }
    
    // Reactアプリとの競合を避けるため追加チェック
    if (document.readyState !== 'complete') {
        window.addEventListener('load', () => {
            setTimeout(initializeBrancher, 1500); // 遅延を増加
        });
        return;
    }
    
    // ChatGPTのReact初期化完了を待つ
    const waitForChatGPT = () => {
        if (document.querySelector('#prompt-textarea')) {
            // ChatGPTのUIが準備完了
            setupExtension();
        } else {
            setTimeout(waitForChatGPT, 500);
        }
    };
    waitForChatGPT();
}
function setupExtension() {
/* ========== 新しいメッセージフィルタリング戦略 ========== */

const MESSAGE_TURN_SELECTOR = 'article[data-testid^="conversation-turn-"]';
const USER_MESSAGE_BLOCK_SELECTOR = 'div[data-message-author-role="user"]';

const PAGINATION_BUTTON_SELECTOR_PREV = 'button[aria-label*="Previous response"], button[aria-label*="前の回答"]';
const PAGINATION_BUTTON_SELECTOR_NEXT = 'button[aria-label*="Next response"], button[aria-label*="次の回答"]';
const PAGINATION_TEXT_SELECTOR = 'form div > span';

function showAllMessages() {
    document.querySelectorAll(MESSAGE_TURN_SELECTOR).forEach(turn => {
        turn.style.display = '';
    });
}

/**
 * 指定されたIDのノードからルート（"client-created-root"の直前）まで遡り、
 * 各ノードのidx値を収集して配列として返す。
 * 配列の順序はルート側から指定IDのノード側へ。
 */
function getpathtonode(ms, clickedElementId) {
  const pathIndices = [];
  let currentId = clickedElementId;
  const rootNodeId = "client-created-root";

  let safetyCount = 0;
  const maxDepth = 100;

  if (!ms || typeof ms !== 'object' || !ms[clickedElementId]) {
    console.error(`getpathtonode: Clicked element ID "${clickedElementId}" not found in ms data, or ms data is invalid.`);
    return [];
  }

  while (currentId && currentId !== rootNodeId && safetyCount < maxDepth) {
    const currentNode = ms[currentId];

    if (!currentNode) {
      console.warn(`getpathtonode: Node with ID "${currentId}" (parent of a previous node) not found in ms data while tracing path for "${clickedElementId}".`);
      break;
    }
    if (currentNode.role != 'user' && currentNode.parent && ms[currentNode.parent] && ms[currentNode.parent].role != 'user'){
        currentId = currentNode.parent;
        safetyCount++;
        continue;
    }

    if (typeof currentNode.idx === 'number') {
      pathIndices.unshift(currentNode.idx);
    } else {
      console.warn(`getpathtonode: Node "${currentId}" is missing 'idx' property or it's not a number. Using 0 as a fallback. idx value:`, currentNode.idx);
      pathIndices.unshift(0);
    }

    if (!currentNode.parent) {
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 修正3: depthベースのスクロール処理
function scrollToConversationTurn(messageId, nodeDepth) {
    // depthベースでturnを計算: root=0なら何もしない、depth 1なら turn 1、depth 2なら turn 2
    if (nodeDepth === 0) return; // rootノードはスクロールしない
    
    const turnElement = document.querySelector(`article[data-testid="conversation-turn-${nodeDepth}"]`);
    if (turnElement) {
        turnElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function processConversationTurns(clickedElementId) {
  // console.log(`Processing for clicked element ID: ${clickedElementId}`);
  const ms = addTurnAndIdxToMessages(gT(cid()));
  const filteredPath = getpathtonode(ms, clickedElementId);
  // console.log('filteredPath:', filteredPath);

  if (!Array.isArray(filteredPath) || !filteredPath.every(num => Number.isInteger(num))) {
    console.error('filteredPath is not a valid array of integers.');
    return;
  }

  const allTurnArticles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
  allTurnArticles.forEach(article => {
    article.style.display = 'none';
  });
  // console.log('All turn articles hidden.');

  for (let i = 0; i < filteredPath.length; i++) {
    const turnNumber = i + 1;
    const targetValueForTurn = filteredPath[i];

    const articleSelector = `article[data-testid="conversation-turn-${turnNumber}"]`;
    const currentArticle = document.querySelector(articleSelector);

    if (!currentArticle) {
      console.warn(`Article not found for turn: ${turnNumber} (selector: ${articleSelector})`);
      continue;
    }

    // console.log(`Processing Turn ${turnNumber}, target value: ${targetValueForTurn}`);

    if (turnNumber % 2 !== 0) {
      // console.log(`Turn ${turnNumber} is ODD.`);
      if (targetValueForTurn !== 0) {
        currentArticle.style.display = '';
        // console.log(`Displaying ${articleSelector}`);

        const tabulerNumsDiv = currentArticle.querySelector('div[class="tabuler-nums"]');
        const prevButton = currentArticle.querySelector('button[aria-label="前の回答"]');
        const nextButton = currentArticle.querySelector('button[aria-label="次の回答"]');

        if (!tabulerNumsDiv) {
          console.warn(`div.tabuler-nums not found in ${articleSelector}`);
          continue;
        }
        if (!prevButton || !nextButton) {
            console.warn(`Navigation buttons not found in ${articleSelector}. Cannot adjust value.`);
            continue;
        }

        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
          const numText = tabulerNumsDiv.textContent.trim();
          const match = numText.match(/^(\d+)\s*\/\s*\d+$/);
          if (!match) {
            console.error(`Could not parse number from div.tabuler-nums in ${articleSelector}. Text: "${numText}"`);
            break;
          }
          let currentIntegerA = parseInt(match[1], 10);
          // console.log(`Turn ${turnNumber}: current A = ${currentIntegerA}, target = ${targetValueForTurn}`);

          if (currentIntegerA === targetValueForTurn) {
            // console.log(`Turn ${turnNumber}: Target value ${targetValueForTurn} reached.`);
            break;
          }

          if (targetValueForTurn < currentIntegerA) {
            // console.log(`Turn ${turnNumber}: Clicking "前の回答" (target: ${targetValueForTurn}, current: ${currentIntegerA})`);
            prevButton.click();
          } else {
            // console.log(`Turn ${turnNumber}: Clicking "次の回答" (target: ${targetValueForTurn}, current: ${currentIntegerA})`);
            nextButton.click();
          }

          await delay(500);
          attempts++;
        }

        if (attempts >= maxAttempts) {
          console.warn(`Turn ${turnNumber}: Max attempts reached. Could not set to target value ${targetValueForTurn}.`);
        }
      } else {
        currentArticle.style.display = '';
        // console.log(`Displaying ${articleSelector} (target value is 0).`);
      }
    }
    else {
      // console.log(`Turn ${turnNumber} is EVEN.`);
      currentArticle.style.display = '';
      // console.log(`Displaying ${articleSelector}`);
    }
  }
  // console.log('Processing finished.');
}

/* ========== 2. fetch hook (MODIFIED) ========== */

function addTurnAndIdxToMessages(msData) {
    const messageMap = {};
    for (const id in msData) {
        messageMap[id] = { ...msData[id], id: id, turn: null, idx: 0 };
    }

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
            if (aTime === null) return -1;
            if (bTime === null) return 1;
            return aTime - bTime;
        });
    }

    for (const id in messageMap) {
        const msg = messageMap[id];
        if (msg.role === "user") {
            const parentId = msg.parent;
            if (parentId && childrenMap[parentId]) {
                const siblingUserMessages = childrenMap[parentId]
                    .map(siblingId => messageMap[siblingId])
                    .filter(sibling => sibling.role === "user");

                if (siblingUserMessages.length > 1) {
                    const indexInSiblings = siblingUserMessages.findIndex(sibling => sibling.id === msg.id);
                    if (indexInSiblings !== -1) {
                        msg.idx = indexInSiblings + 1;
                    }
                } else {
                    msg.idx = 0;
                }
            } else {
                 msg.idx = 0;
            }
        } else {
            msg.idx = 0;
        }
    }

    const assignTurnsRecursively = (nodeId, nextExpectedUserTurn) => {
        const node = messageMap[nodeId];

        if (!node || node.turn !== null) {
            return;
        }

        if (node.role === "user") {
            node.turn = nextExpectedUserTurn;
            const children = childrenMap[nodeId] || [];
            for (const childId of children) {
                assignTurnsRecursively(childId, nextExpectedUserTurn + 2);
            }
        } else {
            node.turn = nextExpectedUserTurn - 1;
            const children = childrenMap[nodeId] || [];
            for (const childId of children) {
                assignTurnsRecursively(childId, nextExpectedUserTurn);
            }
        }
    };

    const initialMessageContainerId = "client-created-root";
    if (childrenMap[initialMessageContainerId]) {
        for (const rootChildId of childrenMap[initialMessageContainerId]) {
             if (messageMap[rootChildId] && messageMap[rootChildId].turn === null) {
                assignTurnsRecursively(rootChildId, 1);
             }
        }
    }

    const resultData = {};
    for (const id in msData) {
        if (messageMap[id]) {
            resultData[id] = {
                parent: messageMap[id].parent,
                role: messageMap[id].role,
                create_time: messageMap[id].create_time,
                idx: messageMap[id].idx,
                turn: messageMap[id].turn
            };
        } else {
            resultData[id] = { ...msData[id] };
        }
    }

    return resultData;
}

// メッセージプレビュー取得関数
function getMessagePreview(messageId) {
    const turnElements = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
    for (const element of turnElements) {
        const messageElement = element.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const textContent = messageElement.textContent || messageElement.innerText || '';
            return textContent.split('\n').slice(0, 5).map(line => line.substring(0, 25)).join('\n');
        }
    }
    return '';
}

// fetchフックのセットアップを確認
// console.log('[Brancher] Setting up fetch hook...');


// console.log('[Brancher] Fetch hook setup complete');

/* ========== 3. buildCondensed() ========== */
function buildCondensed (nodes) {
  if (!nodes || nodes.length === 0) return null;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const childrenOf = {};
  nodes.forEach(n => {
    if (n && n.parent) {
        (childrenOf[n.parent] || (childrenOf[n.parent] = [])).push(n.id);
    }
  });
  for (const parentId in childrenOf) {
  childrenOf[parentId].sort((a, b) => {
    const aTime = byId.get(a)?.create_time || 0;
    const bTime = byId.get(b)?.create_time || 0;
    return aTime - bTime;
  });
}
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
    
    // デバッグログ追加
    // console.log(`[Brancher] Building tree for user node: ${id}`);
    // console.log(`[Brancher] Direct children:`, dirs);
    // console.log(`[Brancher] Direct users:`, directUser);
    // console.log(`[Brancher] Non-users:`, nonUser);
    
    directUser.forEach(uId => {
      const child = walkUser(uId);
      if (child) out.children.push(child);
    });

    // 現在のnonUser配列をソート（522行目付近）
if (nonUser.length) {
  // console.log(`[Brancher] Creating gray node for user ${id}, nonUser messages:`, nonUser);
  
  const sortedNonUser = nonUser.sort((a, b) => {
    const aTime = byId.get(a)?.create_time || 0;
    const bTime = byId.get(b)?.create_time || 0;
    return aTime - bTime;
  });
  
  const allNonUserMessages = [];
  const gray = { id: 'g-' + id, children: [], placeholder: true, data: {role:'placeholder'}, nonUserMessages: [] };
  
  const q = [...nonUser], visit = new Set(q);
  while (q.length) {
    const cur = q.shift();
    // console.log(`[Brancher] Processing node in gray queue: ${cur}, role: ${byId.get(cur)?.role}`);
    
    if (byId.get(cur)?.role === 'user') {
      const child = walkUser(cur);
      if (child) {
        // console.log(`[Brancher] Adding user child to gray node: ${cur}`);
        gray.children.push(child);
      }
    } else {
      if (byId.get(cur) && !allNonUserMessages.includes(cur)) {
        allNonUserMessages.push(cur);
      }
      (childrenOf[cur] || []).forEach(grandKid => {
        if(!visit.has(grandKid)){
             q.push(grandKid);
             visit.add(grandKid);
        }
      });
    }
  }
  
  allNonUserMessages.sort((a, b) => {
    const aTime = byId.get(a)?.create_time || 0;
    const bTime = byId.get(b)?.create_time || 0;
    return aTime - bTime;
  });
  
  gray.nonUserMessages = allNonUserMessages;
  // console.log(`[Brancher] Gray node created with ${gray.children.length} user children and ${allNonUserMessages.length} non-user messages`);
  
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
  width: '420px', height: '540px',
  background: 'transparent',
  pointerEvents: 'none',
  zIndex: 9999,
});
document.body.appendChild(pane);

const miniWrap = document.createElement('div');
Object.assign(miniWrap.style, {
  position: 'absolute',
  opacity: '0',
  transition: 'opacity 0.15s',
  pointerEvents: 'none',
  background: 'transparent',
  zIndex: '1',  // ツリーより奥に配置
});

pane.appendChild(miniWrap);

const miniSvg = d3.select(miniWrap).append('svg')
                  .style('width', '100%')
                  .style('height', '100%')
                  .style('background', isDark() ? '#222' : '#f5f5f5');
const miniG   = miniSvg.append('g');

const scroll = document.createElement('div');
Object.assign(scroll.style, {
  position: 'absolute', inset: '0',
  overflowX: 'hidden', overflowY: 'hidden',
  pointerEvents: 'none',
  background: 'transparent',
  zIndex: '2',  // ミニマップより手前に配置
});

pane.appendChild(scroll);

const svg  = d3.select(scroll).append('svg')
    .style('background', 'transparent')
    .style('pointer-events', 'none');
const gSvg = svg.append('g')
　　.style('pointer-events', 'auto');

// プレビュー表示用の要素
const previewDiv = document.createElement('div');
Object.assign(previewDiv.style, {
  position: 'fixed',
  background: isDark() ? '#333' : '#fff',
  border: `1px solid ${isDark() ? '#555' : '#ccc'}`,
  borderRadius: '4px',
  padding: '8px',
  fontSize: '12px',
  fontFamily: 'monospace',
  maxWidth: '300px',
  maxHeight: '150px',
  overflow: 'hidden',
  whiteSpace: 'pre',
  zIndex: 10000,
  pointerEvents: 'none',
  opacity: '0',
  transition: 'opacity 0.2s'
});
document.body.appendChild(previewDiv);

let isPaneHovered = false;
let isPointerOverTreeElements = false;
let isPointerOverMinimap = false;
pane.addEventListener('mouseenter', () => {
    isPaneHovered = true;
    scroll.style.overflowX = 'auto';
    scroll.style.overflowY = 'auto';
    scroll.style.pointerEvents = 'auto';
    miniWrap.style.opacity = OPACITY_HOVER;
});

pane.addEventListener('mouseleave', () => {
    isPaneHovered = false;
    setTimeout(() => {
        if (!isPaneHovered && !isPointerOverTreeElements && !isPointerOverMinimap) {
            scroll.style.overflowX = 'hidden';
            scroll.style.overflowY = 'hidden';
            scroll.style.pointerEvents = 'none';
            miniWrap.style.opacity = '0';
            miniWrap.style.zIndex = '0';
            miniWrap.style.pointerEvents = 'none';
        }
    }, 100);
});

miniWrap.addEventListener('mouseenter', () => {
    isPointerOverMinimap = true;
    miniWrap.style.pointerEvents = 'auto';
});
miniWrap.addEventListener('mouseleave', () => {
    isPointerOverMinimap = false;
    miniWrap.style.pointerEvents = 'none';
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

  const miniMapScaleFactor = 0.4;
  const miniMapSize = Math.max(60, base * miniMapScaleFactor);
  const miniMapMargin = Math.max(4, paneW * 0.015);

  return {
    radius, gapX, gapY,
    edgeStroke: Math.max(1, radius / 15),
    paneW, paneH, paneRight, paneTop,
    miniMapSize, miniMapMargin
  };
}

/* ========= ミニマップ描画関数 ========= */
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
        .attr('x', vbX + (viewX / gSvgContext.fullW_calc) * vbW)
        .attr('y', vbY + (viewY / Math.max(paneH_calc, fullH_calc)) * vbH)
        .attr('width', (viewW / gSvgContext.fullW_calc) * vbW)
        .attr('height', (viewH / Math.max(paneH_calc, fullH_calc)) * vbH)
        .attr('fill', 'rgba(52,152,219,0.15)').attr('stroke', '#3498db')
        .attr('stroke-width', Math.max(0.3, edgeStroke / 3));
}

/* ========== チャット入力欄 スタイル制御 ========= */
const PROMPT_TEXTAREA_ID = 'prompt-textarea';

function styleChatInput(selected) {
    try{
    // ProseMirrorエディタ（contenteditable div）を探す
    const proseMirrorDiv = document.getElementById(PROMPT_TEXTAREA_ID);
    if (!proseMirrorDiv) return;

    // formエレメントまで遡る
    let targetElement = proseMirrorDiv;
    while (targetElement && targetElement.tagName !== 'FORM') {
        targetElement = targetElement.parentElement;
        if (!targetElement || targetElement.tagName === 'BODY') break;
    }

    if (targetElement && targetElement.tagName === 'FORM') {
        // formの直下の最初のdiv（rounded-[28px]を持つ要素）を対象にする
        const chatContainer = targetElement.querySelector('div.flex.w-full.cursor-text');
        
        if (chatContainer) {
            if (selected) {
                chatContainer.style.border = '2px solid red';
                chatContainer.style.boxSizing = 'border-box';
                // console.log('[Brancher] Chat input border applied - RED');
            } else {
                chatContainer.style.border = '';
                chatContainer.style.boxSizing = '';
                // console.log('[Brancher] Chat input border removed');
            }
        } else {
            // フォールバック: form要素自体に適用
            if (selected) {
                targetElement.style.border = '2px solid red';
                targetElement.style.borderRadius = '28px';
                targetElement.style.boxSizing = 'border-box';
                // console.log('[Brancher] Chat input border applied to form - RED');
            } else {
                targetElement.style.border = '';
                targetElement.style.borderRadius = '';
                targetElement.style.boxSizing = '';
                // console.log('[Brancher] Chat input border removed from form');
            }
        }
    }
}catch (error){
    console.warn('[Brancher] Chat input styling failed:', error);
}
}
// 灰色ノード内の最下位ノードを取得する関数
function findDeepestChild(messageIds, conversationData) {
    if (!messageIds || messageIds.length === 0) return null;
    
    // 親子関係マップを構築（灰色ノード内のメッセージのみ）
    const childrenMap = {};
    messageIds.forEach(id => {
        const parent = conversationData[id]?.parent;
        if (parent && messageIds.includes(parent)) {
            if (!childrenMap[parent]) childrenMap[parent] = [];
            childrenMap[parent].push(id);
        }
    });
    
    // 子を持たないノード（リーフノード）を検出
    const leafNodes = messageIds.filter(id => !childrenMap[id] || childrenMap[id].length === 0);
    
    if (leafNodes.length === 1) {
        return leafNodes[0];
    } else if (leafNodes.length > 1) {
        // 複数のリーフノードがある場合、create_timeで最新を選択
        return leafNodes.sort((a, b) => {
            const aTime = conversationData[a]?.create_time || 0;
            const bTime = conversationData[b]?.create_time || 0;
            return bTime - aTime;
        })[0];
    } else {
        // リーフノードがない場合（循環参照など）、最初のメッセージを返す
        console.warn('[Brancher] No leaf nodes found in gray node messages');
        return messageIds[0];
    }
}

// targetIdの妥当性を検証する関数
function validateTargetId(targetId, conversationData) {
    if (!targetId) return false;
    
    // targetIdが何かしらのuserメッセージの親になっているかチェック
    const hasUserChild = Object.values(conversationData).some(msg => 
        msg.parent === targetId && msg.role === 'user'
    );
    
    if (!hasUserChild) {
        console.error(`[Brancher] Error: targetId ${targetId} is not parent of any user message`);
        return false;
    }
    return true;
}


/* ========= draw() (MODIFIED) ========= */
function draw () {
    const C = cid();
    if (!C) {
        // console.log('[Brancher] No conversation ID found');
        gSvg.selectAll("*").remove(); miniG.selectAll("*").remove();
        return;
    }
    // console.log('[Brancher] Drawing conversation:', C);

    const metrics = uiMetrics();
    const { radius, gapX, gapY, edgeStroke, paneW, paneH, paneRight, paneTop, miniMapSize, miniMapMargin } = metrics;

    pane.style.top = `${paneTop}px`; pane.style.right = `${paneRight}px`;
    pane.style.width = `${paneW}px`; pane.style.height = `${paneH}px`;

    miniWrap.style.width = `${miniMapSize}px`;
    miniWrap.style.height = `${miniMapSize}px`;
    miniWrap.style.right = `${miniMapMargin}px`;
    miniWrap.style.bottom = `${miniMapMargin}px`;

    const conversationData = gT(C);
    // console.log('[Brancher] Conversation data:', conversationData, 'Keys:', Object.keys(conversationData).length);
    if (!conversationData || Object.keys(conversationData).length === 0) {
        // console.log('[Brancher] No conversation data found, waiting for data...');
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
    
    const offsetY = radius + 10;
    const fullH_calc = treeH_calc + offsetY * 2;
    // ツリーが負の位置に描画される場合を考慮
    // ツリーを全幅で描画（ミニマップの位置を考慮しない）
    const leftMargin = Math.max(radius, -minX + radius);
    const offsetX = leftMargin;
    const rightMargin = radius;
    const totalTreeWidth = treeW_calc + leftMargin + rightMargin;

    svg.attr('width', Math.max(paneW, totalTreeWidth));

    // offsetXも再計算

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
        .style('pointer-events', 'stroke')
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
                .style('pointer-events', 'auto')
                .on('mouseenter', function(event) {
                    isPointerOverTreeElements = true;
                    gSvg.style('opacity', OPACITY_HOVER);
                    scroll.style.pointerEvents = 'auto';
                    
                    // 修正4: プレビューを左側に表示
                    let previewText = '';
                    if (dNode.data.placeholder && dNode.data.nonUserMessages) {
                        // 中間ノードの場合、最後のメッセージのプレビューを表示
                        const lastMessageId = dNode.data.nonUserMessages[dNode.data.nonUserMessages.length - 1];
                        previewText = getMessagePreview(lastMessageId);
                    } else if (!dNode.data.placeholder) {
                        previewText = getMessagePreview(dNode.data.id);
                    }
                    
                    if (previewText) {
                        previewDiv.textContent = previewText;
                        // プレビューの幅を計算して左側に配置
                        const previewWidth = previewDiv.offsetWidth || 300; // デフォルト幅
                        previewDiv.style.left = `${event.pageX - previewWidth - 10}px`;
                        previewDiv.style.top = `${event.pageY + 10}px`;
                        previewDiv.style.opacity = '1';
                    }
                })
                .on('mouseleave', function() {
                    isPointerOverTreeElements = false;
                    gSvg.style('opacity', OPACITY_IDLE);
                    previewDiv.style.opacity = '0';
                });

            const isPl = dNode.data.placeholder;
            const isRoot = dNode.depth === 0 && !isPl;
            const isSel = !isPl && dNode.data.id === sel;
            
            // 修正1: 選択されたノードの親（灰色ノード）を探す
            let isParentOfSelected = false;
            let isPlaceholderSelected = false;
            
            if (sel && isPl && dNode.data.nonUserMessages) {
                // 灰色ノード自体が選択されているかチェック
                // 選択されたメッセージIDが灰色ノードのnonUserMessagesに含まれているか
                isPlaceholderSelected = dNode.data.nonUserMessages.includes(sel);
                
                // 選択されたノードがrole:userで、この灰色ノードの子にuserノードがある場合
                if (conversationData[sel] && conversationData[sel].role === 'user') {
                    if (dNode.children) {
                        for (const child of dNode.children) {
                            if (child.data.id === sel) {
                                isParentOfSelected = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (isPl) {
                // 中間ノード（灰色ノード）の処理
                let fillColor;
                if (isPlaceholderSelected) {
                    fillColor = '#dc3545'; // 選択中は赤
                } else if (isParentOfSelected) {
                    fillColor = '#dc3545'; // 修正1: userノードの親も赤
                } else {
                    fillColor = '#b0b0b0'; // 通常は灰色
                }
                
                circle.attr('fill', fillColor)
                    .style('cursor', 'pointer')
                    .on('click', (event) => {
                        event.stopPropagation();
                        const C_local = cid(); if (!C_local) return;

                        // 修正2: 中間ノードの場合、親子関係に基づいて最下位メッセージIDを使用
let targetMessageId = null;
if (dNode.data.nonUserMessages && dNode.data.nonUserMessages.length > 0) {
    const conversationData = gT(C_local);
    targetMessageId = findDeepestChild(dNode.data.nonUserMessages, conversationData);
    
     console.log('[DEBUG] Gray node clicked:', dNode.data.id);
     console.log('[DEBUG] nonUserMessages:', dNode.data.nonUserMessages);
     console.log('[DEBUG] targetMessageId (deepest child):', targetMessageId);
    
    // バリデーション
    if (!validateTargetId(targetMessageId, conversationData)) {
        console.error('[Brancher] Invalid targetId, aborting selection');
        return; // クリック処理を中断
    }
}


                        if (gSel(C_local) === targetMessageId) {
                            sSel(C_local, null);
                            showAllMessages();
                            styleChatInput(false);
                        } else {
                            if (targetMessageId) {
                                sSel(C_local, targetMessageId);
                                scrollToConversationTurn(targetMessageId, dNode.depth);
                                styleChatInput(true);
                            }
                        }
                        draw();
                    });
            } else {
                // 通常のノードの処理
                let fillColor;
                if (isRoot) {
                    fillColor = '#777';
                } else if (isSel) {
                    // 修正1: role:userノード選択時は緑色
                    if (conversationData[sel] && conversationData[sel].role === 'user') {
                        fillColor = '#28a745'; // 緑色
                    } else {
                        fillColor = '#dc3545'; // role!=userは赤色
                    }
                } else {
                    fillColor = '#0d6efd';
                }

                circle.attr('fill', fillColor)
                    .style('cursor', isRoot ? 'default' : 'pointer')
                    .on('click', isRoot ? null : (event) => {
                        event.stopPropagation();
                        const C_local = cid(); if (!C_local) return;
                        const clickedNodeId = dNode.data.id;

                        if (gSel(C_local) === clickedNodeId) {
                            sSel(C_local, null);
                            showAllMessages();
                            styleChatInput(false);
                        } else {
                            sSel(C_local, clickedNodeId);
                            if (dNode.data.role === 'user') {
                                processConversationTurns(clickedNodeId);
                            } else {
                                scrollToConversationTurn(clickedNodeId, dNode.depth);
                            }
                            styleChatInput(true);
                        }
                        draw();
                    });
            }
        });
    nodeSelection.exit().remove();
    const gSvgRenderContext = {
    treeW_calc: treeW_calc, treeH_calc: treeH_calc,
    minX_calc: minX, minY_calc: minY,
    // gSvgRenderContextの修正（1103行目付近）
    fullW_calc: Math.max(paneW, totalTreeWidth),

    paneW_calc: paneW, paneH_calc: paneH
};

    updateMinimap(h, metrics, sel, scroll, pane, gSvgRenderContext);
}

/* ========= Event Listeners & Init ========= */
scroll.addEventListener('scroll', () => {
    requestAnimationFrame(draw);
});
window.addEventListener('resize', () => requestAnimationFrame(draw));
window.addEventListener('popstate', () => {
    setTimeout(() => {
        showAllMessages();
        sSel(cid(), null);
        styleChatInput(false);
        draw();
    }, 500);
});

const observerTargetNode = document.querySelector('main') || document.body;
if (observerTargetNode) {
    let debounceTimer;
    const debouncedDraw = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const C = cid();
            const selectedId = gSel(C);
            if (selectedId) {
                // DOM変更があった場合の処理は簡略化
            }
            requestAnimationFrame(draw);
        }, 350);
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

} // initializeBrancher関数の終了
const origFetch = window.fetch;
// console.log('[Brancher] Original fetch function:', typeof origFetch);

window.fetch = async (input, init) => {
    const url = (typeof input === 'string') ? input : input.url;
    const conf = { ...(init || {}) };
    const isConv = typeof url === 'string' && url.includes('/backend-api/conversation');

    if (isConv) {
         console.log('[Brancher] Intercepted conversation API call:', url);
    }

    if (!isConv) return origFetch(input, conf);

    let reqBodyObj = {};
    if (conf.body) {
        try { reqBodyObj = JSON.parse(conf.body); } catch (e) { /*ignore*/ }
    }

    const C = reqBodyObj.conversation_id || cid();
    // console.log('[Brancher] Conversation ID from request:', C);

  if (C && reqBodyObj.messages?.[0]) {
    const u = reqBodyObj.messages[0];
    const selectedMessageId = gSel(C);
    
    let parentId = reqBodyObj.parent_message_id || null;
    
    if (selectedMessageId) {
        const conversationData = gT(C);
        const selectedNode = conversationData[selectedMessageId];
        
        if (selectedNode?.role === 'user') {
            // 青色ノード選択時: 選択されたuserノードの親を使用
            parentId = selectedNode.parent;
        } else {
            // 灰色ノード選択時: selectedMessageIdを直接使用
            parentId = selectedMessageId;
        }
    }
    
    mT(C, {[u.id]: {
        parent: parentId,
        role: 'user',
        create_time: u.create_time || (Date.now() / 1000)
    }});
}



    // 修正2: role!=userノード選択時のparent_message_id処理
    if (C && reqBodyObj.action === 'next') {
        const selectedMessageId = gSel(C);
        if (selectedMessageId) {
            const conversationTree = gT(C);
            const selectedNodeDetails = conversationTree[selectedMessageId];
            if (selectedNodeDetails) {
                if (selectedNodeDetails.role === 'user') {
                    reqBodyObj.parent_message_id = selectedNodeDetails.parent;
                } else {
                    // role!=userのノードを選択中の場合、selectedMessageIdを使用
                    reqBodyObj.parent_message_id = selectedMessageId;
                }
                conf.body = JSON.stringify(reqBodyObj);
            } else {
                // 灰色ノード（placeholderノード）の場合
                // selectedMessageIdの中から最後のメッセージIDを取得
                // selectedMessageIdは実際には灰色ノードIDではなく、その中の最後のメッセージIDとして保存されている
                reqBodyObj.parent_message_id = selectedMessageId;
                conf.body = JSON.stringify(reqBodyObj);
            }
        }
    }

    const response = await origFetch(input, conf);
    const clonedResponse = response.clone();
    const contentType = clonedResponse.headers.get('content-type') || '';

    const saveAssistant = (msgId, parentUser, msgCreateTime) => {
    if (C) {
        // console.log('[Brancher] Saving assistant message:', msgId, 'parent:', parentUser);
        mT(C, {[msgId]: {parent: parentUser, role: 'assistant', create_time: msgCreateTime}});
        setTimeout(() => draw(), 100); // 少し遅延させて確実に更新
    }
};


    if (contentType.startsWith('text/event-stream')) {
        // console.log('[Brancher] Processing event stream response');
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
        // console.log('[Brancher] Processing JSON response');
        clonedResponse.json().then(jsonResponse => {
            if (!jsonResponse.mapping) return;
            if (!C) return;
            const patch = {};
            // console.log('[Brancher] Processing mapping with', Object.keys(jsonResponse.mapping).length, 'nodes');
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
                // console.log('[Brancher] Saving patch with', Object.keys(patch).length, 'items');
                mT(C, patch);
                draw();
            }
        }).catch(err => console.error('[Brancher] Error processing JSON response:', err));
    }
    return response;
};
// 初期化を実行
initializeBrancher();

})();
