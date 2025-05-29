(function () {
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
        const verification = localStorage.getItem(k);
        if (!verification) {
            console.error('[Brancher] localStorage save failed - item not found after save');
        }
    } catch (e) {
        console.error('[Brancher] Error saving to localStorage:', e, 'Key:', k, 'Object:', o);
    }
};
const gT=c=>g(kT(c)), sT=(c,o)=>s(kT(c),o), mT=(c,p)=>sT(c,{...gT(c),...p});
const gSel=c=>localStorage.getItem(kS(c)), sSel=(c,id)=>id?localStorage.setItem(kS(c),id):localStorage.removeItem(kS(c));

window.tree=(c=cid())=>gT(c);

function initializeBrancher() {
    if (!window.d3) {
        console.error('[Brancher] D3.js not loaded');
        return;
    }
    
    if (!document.body) {
        setTimeout(initializeBrancher, 100);
        return;
    }
    
    if (document.readyState !== 'complete') {
        window.addEventListener('load', () => {
            setTimeout(initializeBrancher, 1500);
        });
        return;
    }
    
    const waitForChatGPT = () => {
        if (document.querySelector('#prompt-textarea')) {
            setupExtension();
        } else {
            setTimeout(waitForChatGPT, 500);
        }
    };
    waitForChatGPT();
}

function setupExtension() {
const MESSAGE_TURN_SELECTOR = 'article[data-testid^="conversation-turn-"]';

function showAllMessages() {
    document.querySelectorAll(MESSAGE_TURN_SELECTOR).forEach(turn => {
        turn.style.display = '';
    });
}

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
      console.warn(`getpathtonode: Node with ID "${currentId}" not found in ms data while tracing path for "${clickedElementId}".`);
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

function scrollToConversationTurn(messageId, nodeDepth) {
    if (nodeDepth === 0) return;
    
    const turnElement = document.querySelector(`article[data-testid="conversation-turn-${nodeDepth}"]`);
    if (turnElement) {
        turnElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function processConversationTurns(clickedElementId) {
  const ms = addTurnAndIdxToMessages(gT(cid()));
  const filteredPath = getpathtonode(ms, clickedElementId);

  if (!Array.isArray(filteredPath) || !filteredPath.every(num => Number.isInteger(num))) {
    console.error('filteredPath is not a valid array of integers.');
    return;
  }

  const allTurnArticles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
  allTurnArticles.forEach(article => {
    article.style.display = 'none';
  });

  for (let i = 0; i < filteredPath.length; i++) {
    const turnNumber = i + 1;
    const targetValueForTurn = filteredPath[i];

    const articleSelector = `article[data-testid="conversation-turn-${turnNumber}"]`;
    const currentArticle = document.querySelector(articleSelector);

    if (!currentArticle) {
      console.warn(`Article not found for turn: ${turnNumber} (selector: ${articleSelector})`);
      continue;
    }

    if (turnNumber % 2 !== 0) {
      if (targetValueForTurn !== 0) {
        currentArticle.style.display = '';

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

          if (currentIntegerA === targetValueForTurn) {
            break;
          }

          if (targetValueForTurn < currentIntegerA) {
            prevButton.click();
          } else {
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
      }
    }
    else {
      currentArticle.style.display = '';
    }
  }
}

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
    
    directUser.forEach(uId => {
      const child = walkUser(uId);
      if (child) out.children.push(child);
    });

if (nonUser.length) {
  const allNonUserMessages = [];
  const gray = { id: 'g-' + id, children: [], placeholder: true, data: {role:'placeholder'}, nonUserMessages: [] };
  
  const q = [...nonUser], visit = new Set(q);
  while (q.length) {
    const cur = q.shift();
    
    if (byId.get(cur)?.role === 'user') {
      const child = walkUser(cur);
      if (child) {
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
  
  if(gray.children.length > 0 || nonUser.some(nu => byId.get(nu)?.role === 'assistant') ){
       out.children.push(gray);
  }
}
    return out;
  }
  const hierarchyData = walkUser(rootUser.id);
  if (!hierarchyData) return null;
  return d3.hierarchy(hierarchyData, d => d.children);
}

const isDark = () => document.documentElement.classList.contains('dark');

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
  zIndex: '1',
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
  zIndex: '2',
});

pane.appendChild(scroll);

const svg  = d3.select(scroll).append('svg')
    .style('background', 'transparent')
    .style('pointer-events', 'none');
const gSvg = svg.append('g')
　　.style('pointer-events', 'auto');

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
            miniWrap.style.zIndex = '1'
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

function updateMinimap(h, metrics, sel, scrollElement, paneElement, gSvgContext) {
    const { radius, edgeStroke } = metrics;
    const { treeW_calc, treeH_calc, minX_calc, minY_calc, fullH_calc, paneW_calc, paneH_calc } = gSvgContext;

    miniSvg.style('background', isDark() ? '#222' : '#f5f5f5');
    const descendants = h.descendants();
    if (descendants.length === 0) {
        miniG.selectAll("*").remove();
        return;
    }

    const leftMargin = Math.max(radius, -minX_calc + radius);
    const rightMargin = radius;
    const totalTreeWidth = treeW_calc + leftMargin + rightMargin;

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

    const safeFullH = isFinite(fullH_calc) ? fullH_calc : paneH_calc;
    const heightDivisor = Math.max(paneH_calc, safeFullH);

    miniG.selectAll('rect.view').data([null]).join('rect').attr('class', 'view')
        .attr('x', vbX + (viewX / gSvgContext.fullW_calc) * vbW)
        .attr('y', vbY + (viewY / heightDivisor) * vbH)
        .attr('width', (viewW / gSvgContext.fullW_calc) * vbW)
        .attr('height', (viewH / heightDivisor) * vbH)
        .attr('fill', 'rgba(52,152,219,0.15)').attr('stroke', '#3498db')
        .attr('stroke-width', Math.max(0.3, edgeStroke / 3));
}

const PROMPT_TEXTAREA_ID = 'prompt-textarea';

function styleChatInput(selected) {
    try{
    const proseMirrorDiv = document.getElementById(PROMPT_TEXTAREA_ID);
    if (!proseMirrorDiv) return;

    let targetElement = proseMirrorDiv;
    while (targetElement && targetElement.tagName !== 'FORM') {
        targetElement = targetElement.parentElement;
        if (!targetElement || targetElement.tagName === 'BODY') break;
    }

    if (targetElement && targetElement.tagName === 'FORM') {
        const chatContainer = targetElement.querySelector('div.flex.w-full.cursor-text');
        
        if (chatContainer) {
            if (selected) {
                chatContainer.style.border = '2px solid red';
                chatContainer.style.boxSizing = 'border-box';
            } else {
                chatContainer.style.border = '';
                chatContainer.style.boxSizing = '';
            }
        } else {
            if (selected) {
                targetElement.style.border = '2px solid red';
                targetElement.style.borderRadius = '28px';
                targetElement.style.boxSizing = 'border-box';
            } else {
                targetElement.style.border = '';
                targetElement.style.borderRadius = '';
                targetElement.style.boxSizing = '';
            }
        }
    }
}catch (error){
    console.warn('[Brancher] Chat input styling failed:', error);
}
}

function findDeepestChild(messageIds, conversationData) {
    if (!messageIds || messageIds.length === 0) return null;
    
    const childrenMap = {};
    messageIds.forEach(id => {
        const parent = conversationData[id]?.parent;
        if (parent && messageIds.includes(parent)) {
            if (!childrenMap[parent]) childrenMap[parent] = [];
            childrenMap[parent].push(id);
        }
    });
    
    const leafNodes = messageIds.filter(id => !childrenMap[id] || childrenMap[id].length === 0);
    
    if (leafNodes.length === 1) {
        return leafNodes[0];
    } else if (leafNodes.length > 1) {
        return leafNodes.sort((a, b) => {
            const aTime = conversationData[a]?.create_time || 0;
            const bTime = conversationData[b]?.create_time || 0;
            return bTime - aTime;
        })[0];
    } else {
        console.warn('[Brancher] No leaf nodes found in gray node messages');
        return messageIds[0];
    }
}

function validateTargetId(targetId, conversationData) {
    if (!targetId) return false;
    
    const hasUserChild = Object.values(conversationData).some(msg => 
        msg.parent === targetId && msg.role === 'user'
    );
    
    if (!hasUserChild) {
        console.error(`[Brancher] Error: targetId ${targetId} is not parent of any user message`);
        return false;
    }
    return true;
}

function draw () {
    const C = cid();
    if (!C) {
        gSvg.selectAll("*").remove(); miniG.selectAll("*").remove();
        return;
    }

    const metrics = uiMetrics();
    const { radius, gapX, gapY, edgeStroke, paneW, paneH, paneRight, paneTop, miniMapSize, miniMapMargin } = metrics;

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
    
    const offsetY = radius + 10;
    const fullH_calc = treeH_calc + offsetY * 2;
    const leftMargin = Math.max(radius, -minX + radius);
    const offsetX = leftMargin;
    const rightMargin = radius;
    const totalTreeWidth = treeW_calc + leftMargin + rightMargin;

    svg.attr('width', Math.max(paneW, totalTreeWidth));
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
                    
                    let previewText = '';
                    if (dNode.data.placeholder && dNode.data.nonUserMessages) {
                        const lastMessageId = dNode.data.nonUserMessages[dNode.data.nonUserMessages.length - 1];
                        previewText = getMessagePreview(lastMessageId);
                    } else if (!dNode.data.placeholder) {
                        previewText = getMessagePreview(dNode.data.id);
                    }
                    
                    if (previewText) {
                        previewDiv.textContent = previewText;
                        const previewWidth = previewDiv.offsetWidth || 300;
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
            
            let isParentOfSelected = false;
            let isPlaceholderSelected = false;
            
            if (sel && isPl && dNode.data.nonUserMessages) {
                isPlaceholderSelected = dNode.data.nonUserMessages.includes(sel);
                
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
                let fillColor;
                if (isPlaceholderSelected) {
                    fillColor = '#dc3545';
                } else if (isParentOfSelected) {
                    fillColor = '#dc3545';
                } else {
                    fillColor = '#b0b0b0';
                }
                
                circle.attr('fill', fillColor)
                    .style('cursor', 'pointer')
                    .on('click', (event) => {
                        event.stopPropagation();
                        const C_local = cid(); if (!C_local) return;

let targetMessageId = null;
if (dNode.data.nonUserMessages && dNode.data.nonUserMessages.length > 0) {
    const conversationData = gT(C_local);
    targetMessageId = findDeepestChild(dNode.data.nonUserMessages, conversationData);
    
    if (!validateTargetId(targetMessageId, conversationData)) {
        console.error('[Brancher] Invalid targetId, aborting selection');
        return;
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
                let fillColor;
                if (isRoot) {
                    fillColor = '#777';
                } else if (isSel) {
                    if (conversationData[sel] && conversationData[sel].role === 'user') {
                        fillColor = '#28a745';
                    } else {
                        fillColor = '#dc3545';
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
        treeW_calc: treeW_calc, 
        treeH_calc: treeH_calc,
        minX_calc: minX, 
        minY_calc: minY,
        fullH_calc: fullH_calc,
        fullW_calc: Math.max(paneW, totalTreeWidth),
        paneW_calc: paneW, 
        paneH_calc: paneH
    };

    updateMinimap(h, metrics, sel, scroll, pane, gSvgRenderContext);
}

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

}

const origFetch = window.fetch;

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
        try { reqBodyObj = JSON.parse(conf.body); } catch (e) { }
    }

    const C = reqBodyObj.conversation_id || cid();

  if (C && reqBodyObj.messages?.[0]) {
    const u = reqBodyObj.messages[0];
    const selectedMessageId = gSel(C);
    
    let parentId = reqBodyObj.parent_message_id || null;
    
    if (selectedMessageId) {
        const conversationData = gT(C);
        const selectedNode = conversationData[selectedMessageId];
        
        if (selectedNode?.role === 'user') {
            parentId = selectedNode.parent;
        } else {
            parentId = selectedMessageId;
        }
    }
    
    mT(C, {[u.id]: {
        parent: parentId,
        role: 'user',
        create_time: u.create_time || (Date.now() / 1000)
    }});
}

    if (C && reqBodyObj.action === 'next') {
        const selectedMessageId = gSel(C);
        if (selectedMessageId) {
            const conversationTree = gT(C);
            const selectedNodeDetails = conversationTree[selectedMessageId];
            if (selectedNodeDetails) {
                if (selectedNodeDetails.role === 'user') {
                    reqBodyObj.parent_message_id = selectedNodeDetails.parent;
                } else {
                    reqBodyObj.parent_message_id = selectedMessageId;
                }
                conf.body = JSON.stringify(reqBodyObj);
            } else {
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
        mT(C, {[msgId]: {parent: parentUser, role: 'assistant', create_time: msgCreateTime}});
        setTimeout(() => draw(), 100);
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
                    } catch (e) { }
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

initializeBrancher();

})();
