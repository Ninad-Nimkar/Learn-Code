/**
 * GhostScreen — script.js
 * Lightweight interactions: explorer toggle, tab switching,
 * line numbers, OpenAI API integration, and Firestore persistence.
 */

(function () {
  'use strict';

  // ── DOM References ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const textarea       = $('#code-textarea');
  const lineNumbers    = $('#line-numbers');
  const codeHighlight  = $('#code-highlight');
  const codeContent    = $('#code-content');
  const explorerToggle = $('#explorer-toggle');
  const explorerFiles  = $('#explorer-files');
  const btnRun         = $('#btn-run');
  const btnExplain     = $('#btn-explain');
  const tabOutput      = $('#tab-output');
  const tabAI          = $('#tab-ai');
  const contentOutput  = $('#content-output');
  const contentAI      = $('#content-ai');
  const terminalOutput = $('#terminal-output');
  const aiOutput       = $('#ai-output');
  const statRuns       = $('#stat-runs');
  const statErrors     = $('#stat-errors');
  const statSuccess    = $('#stat-success');
  const statXP         = $('#stat-xp');

  // ── State ──
  let runCount   = 0;
  let errorCount = 0;
  let xp         = 0;

  // ── File System State ──
  const files = [
    { name: "main.py", content: "# Start typing your code here...\n" },
    { name: "utils.py", content: "def helper():\n    pass\n" },
    { name: "README.md", content: "# GhostScreen Project\n\n" }
  ];
  let activeFile = "main.py";

  function getFileContent(name) {
    const file = files.find(f => f.name === name);
    return file ? file.content : "";
  }

  function setFileContent(name, content) {
    const file = files.find(f => f.name === name);
    if (file) file.content = content;
  }

  // ── Firestore Reference ──
  const db = window.db;
  const runsCollection = db ? db.collection('runs') : null;

  // ── Firestore Helpers ──
  async function saveRun(code, result, type) {
    if (!runsCollection) return;
    try {
      await runsCollection.add({
        code: code.substring(0, 500),
        result: result.substring(0, 500),
        type: type,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Firestore save failed:', err.message);
    }
  }

  async function loadStats() {
    if (!runsCollection) return;
    try {
      const snapshot = await runsCollection.get();
      runCount = snapshot.size;
      errorCount = 0;
      snapshot.forEach((doc) => {
        if (doc.data().type === 'error') errorCount++;
      });
      const successCount = runCount - errorCount;
      xp = (runCount * 10) + (successCount * 5);
      updateStats();
    } catch (err) {
      console.error('Firestore load failed:', err.message);
    }
  }

  async function loadHistory() {
    if (!runsCollection) return [];
    try {
      const snapshot = await runsCollection
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      const history = [];
      snapshot.forEach((doc) => history.push(doc.data()));
      return history;
    } catch (err) {
      console.error('Firestore history load failed:', err.message);
      return [];
    }
  }

  // ============================================
  // 1. LINE NUMBERS
  // ============================================
  function updateLineNumbers() {
    const lines = textarea.value.split('\n').length;
    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= lines; i++) {
      const span = document.createElement('span');
      span.textContent = i;
      fragment.appendChild(span);
    }
    lineNumbers.innerHTML = '';
    lineNumbers.appendChild(fragment);
  }

  // ── Syntax Highlighting ──
  function updateHighlight() {
    if (!codeContent) return;
    
    // Set text and highlight
    codeContent.textContent = textarea.value;
    
    // Check if Prism is loaded
    if (window.Prism) {
      Prism.highlightElement(codeContent);
    }
  }

  // Sync scroll positions
  function syncScroll() {
    lineNumbers.scrollTop = textarea.scrollTop;
    if (codeHighlight) {
      codeHighlight.scrollTop = textarea.scrollTop;
      codeHighlight.scrollLeft = textarea.scrollLeft;
    }
  }

  textarea.addEventListener('input', () => {
    updateLineNumbers();
    setFileContent(activeFile, textarea.value);
    updateHighlight();
  });
  textarea.addEventListener('scroll', syncScroll);
  textarea.addEventListener('keydown', (e) => {
    // Tab key inserts spaces instead of changing focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 4;
      updateLineNumbers();
      setFileContent(activeFile, textarea.value);
      updateHighlight();
    }
  });

  // Initial render
  updateLineNumbers();

  // ============================================
  // 2. EXPLORER TOGGLE
  // ============================================
  explorerToggle.addEventListener('click', () => {
    const isCollapsed = explorerToggle.classList.toggle('is-collapsed');
    explorerFiles.classList.toggle('is-hidden', isCollapsed);
    explorerToggle.setAttribute('aria-expanded', !isCollapsed);
  });

  explorerToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      explorerToggle.click();
    }
  });

  // ── File System Initialization & Explorer ──
  function renderExplorer() {
    explorerFiles.innerHTML = "";
    files.forEach(f => {
      const li = document.createElement("li");
      li.className = "explorer-files__item" + (f.name === activeFile ? " is-active" : "");
      li.dataset.file = f.name;
      let icon = "📄";
      let iconClass = "file-icon--misc";
      if (f.name.endsWith(".py")) { icon = "🐍"; iconClass = "file-icon--py"; }
      else if (f.name.endsWith(".md")) { icon = "📄"; iconClass = "file-icon--md"; }
      
      li.innerHTML = `<span class="explorer-files__icon ${iconClass}">${icon}</span><span>${f.name}</span>`;
      
      li.addEventListener("click", () => openFile(f.name));
      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        contextTargetFile = f.name;
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
          contextMenu.style.display = 'block';
          contextMenu.style.left = e.pageX + 'px';
          contextMenu.style.top = e.pageY + 'px';
        }
      });
      explorerFiles.appendChild(li);
    });
  }

  function openFile(name) {
    activeFile = name;
    renderExplorer();
    
    const tab = $('#editor-tab-main');
    if (tab) {
      let icon = "📄";
      if (name.endsWith(".py")) icon = "🐍";
      tab.innerHTML = `<span class="editor__tab-icon">${icon}</span> ${name}`;
    }
    
    textarea.value = getFileContent(name);
    updateLineNumbers();
    updateHighlight();
  }

  // Initialize explorer
  openFile(activeFile);

  // ── Menu item click ──
  $$('.sidebar__menu-item').forEach((item) => {
    item.addEventListener('click', () => {
      $$('.sidebar__menu-item').forEach((i) => i.classList.remove('is-active'));
      item.classList.add('is-active');

      const view = item.dataset.view;
      if (view === 'editor') {
        textarea.focus();
      } else if (view === 'ai') {
        switchTab('ai-explanation');
      } else if (view === 'history') {
        switchTab('output');
        terminalOutput.innerHTML = `<span class="prompt">$</span> History view...<span class="terminal-cursor"></span>`;
      } else if (view === 'stats') {
        const modal = document.getElementById('stats-modal');
        if (modal) modal.classList.add('is-visible');
        
        // Also flash the strip for extra effect
        const statsStrip = $('#stats-strip');
        if (statsStrip) {
          statsStrip.style.boxShadow = 'inset 0 0 20px rgba(124, 58, 237, 0.4)';
          setTimeout(() => statsStrip.style.boxShadow = '', 600);
        }
      }
    });
  });

  // ============================================
  // 3. BOTTOM PANEL — TAB SWITCHING
  // ============================================
  function switchTab(tabName) {
    // Update tab states
    tabOutput.classList.toggle('is-active', tabName === 'output');
    tabAI.classList.toggle('is-active', tabName === 'ai-explanation');

    // Update content visibility
    contentOutput.classList.toggle('is-visible', tabName === 'output');
    contentAI.classList.toggle('is-visible', tabName === 'ai-explanation');
  }

  tabOutput.addEventListener('click', () => switchTab('output'));
  tabAI.addEventListener('click', () => switchTab('ai-explanation'));

  // ============================================
  // 4. RUN CODE — OpenAI API
  // ============================================
  const API_BASE = 'http://localhost:3000';

  function updateStats() {
    const successRate = runCount > 0
      ? Math.round(((runCount - errorCount) / runCount) * 100)
      : 0;
    statRuns.textContent = runCount;
    statErrors.textContent = errorCount;
    statSuccess.textContent = successRate + '%';
    statXP.textContent = xp;
    
    const mRuns = document.getElementById('modal-stat-runs');
    const mErrors = document.getElementById('modal-stat-errors');
    const mSuccess = document.getElementById('modal-stat-success');
    const mXP = document.getElementById('modal-stat-xp');
    if (mRuns) mRuns.textContent = runCount;
    if (mErrors) mErrors.textContent = errorCount;
    if (mSuccess) mSuccess.textContent = successRate + '%';
    if (mXP) mXP.textContent = xp;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  btnRun.addEventListener('click', async () => {
    const code = textarea.value.trim();
    if (!code) return;

    runCount++;
    xp += 10;

    // Visual feedback on button
    btnRun.classList.add('is-running');
    btnRun.disabled = true;

    // Switch to output tab & show loading
    switchTab('output');
    terminalOutput.innerHTML =
      `<span class="prompt">$</span> Analyzing your code...<span class="terminal-cursor"></span>`;

    try {
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      const isError = data.result.toLowerCase().includes('error');
      if (isError) errorCount++;
      else xp += 5;

      const type = isError ? 'error' : 'success';

      terminalOutput.innerHTML =
        `<span class="prompt">$</span> run code\n` +
        `<span class="${isError ? 'error-text' : 'success'}">${escapeHtml(data.result)}</span>\n\n` +
        `<span class="prompt">$</span> <span class="terminal-cursor"></span>`;

      // Save to Firestore
      saveRun(code, data.result, type);
    } catch (err) {
      errorCount++;
      terminalOutput.innerHTML =
        `<span class="prompt">$</span> run code\n` +
        `<span class="error-text">Something went wrong. Make sure the backend is running.</span>\n` +
        `<span class="prompt">$</span> <span class="terminal-cursor"></span>`;

      // Save error to Firestore
      saveRun(code, 'Backend connection failed', 'error');
    } finally {
      btnRun.classList.remove('is-running');
      btnRun.disabled = false;
      updateStats();
    }
  });

  // ============================================
  // 5. EXPLAIN CODE — OpenAI API
  // ============================================
  btnExplain.addEventListener('click', async () => {
    const code = textarea.value.trim();
    if (!code) return;

    xp += 5;
    switchTab('ai-explanation');
    btnExplain.disabled = true;

    const chatMessages = $('#chat-messages');
    let aiDiv = null;

    if (chatMessages) {
      const msgDiv = document.createElement('div');
      msgDiv.style.marginBottom = '8px';
      msgDiv.style.color = 'var(--on-surface)';
      msgDiv.style.fontSize = '13px';
      msgDiv.innerHTML = `<strong>👤 You:</strong> Please explain my code.`;
      chatMessages.appendChild(msgDiv);

      aiDiv = document.createElement('div');
      aiDiv.style.marginBottom = '8px';
      aiDiv.style.color = 'var(--on-surface-variant)';
      aiDiv.style.fontSize = '13px';
      aiDiv.innerHTML = `<strong>🤖 Analyzing your code...</strong>`;
      chatMessages.appendChild(aiDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    try {
      const res = await fetch(`${API_BASE}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (aiDiv) {
        const formatted = data.result
          .split('\n')
          .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : ''))
          .join('');
        aiDiv.innerHTML = `<strong>🤖 AI Code Analysis</strong><br>` + formatted;
      }
    } catch (err) {
      if (aiDiv) {
        aiDiv.innerHTML = `<strong>🤖 AI Code Analysis</strong><br>Something went wrong. Make sure the backend is running.`;
      }
    } finally {
      btnExplain.disabled = false;
      updateStats();
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });

  // ============================================
  // 6. THEME TOGGLE
  // ============================================
  const themes = ['dark', 'light', 'floral', 'forest', 'ocean'];
  let currentThemeIndex = 0;

  $('#btn-theme').addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const newTheme = themes[currentThemeIndex];
    document.documentElement.setAttribute('data-theme', newTheme);
    
    const btn = $('#btn-theme');
    btn.innerHTML = `<span>🎨</span> ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)}`;
    btn.style.boxShadow = '0 0 16px rgba(124, 58, 237, 0.5)';
    setTimeout(() => { btn.style.boxShadow = ''; }, 600);
  });

  // ============================================
  // 7. FILE ACTIONS & NEW FILE
  // ============================================
  const btnClear = $('#btn-clear');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      textarea.value = '';
      setFileContent(activeFile, '');
      updateLineNumbers();
      updateHighlight();
    });
  }

  const btnDownload = $('#btn-download');
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      const content = getFileContent(activeFile);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeFile;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const btnNewFile = $('#btn-new-file');
  if (btnNewFile) {
    btnNewFile.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent explorer toggle
      let i = 1;
      let newName = `file${i}.py`;
      while (files.find(f => f.name === newName)) {
        i++;
        newName = `file${i}.py`;
      }
      files.push({ name: newName, content: "" });
      openFile(newName);
    });
  }

  // ============================================
  // 8. STATS STRIP — Settings & Exit (placeholder)
  // ============================================
  $('#btn-strip-settings').addEventListener('click', () => {
    const btn = $('#btn-strip-settings');
    btn.style.color = 'var(--primary)';
    setTimeout(() => { btn.style.color = ''; }, 600);
  });

  $('#btn-strip-exit').addEventListener('click', () => {
    const btn = $('#btn-strip-exit');
    btn.style.color = 'var(--error)';
    setTimeout(() => { btn.style.color = ''; }, 600);
  });

  // ============================================
  // 9. LOAD STATS FROM FIRESTORE ON STARTUP
  // ============================================
  loadStats();

  // ============================================
  // 10. CONTEXT MENU & CHAT
  // ============================================
  let contextTargetFile = null;

  document.addEventListener('click', () => {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) contextMenu.style.display = 'none';
  });

  const ctxRename = document.getElementById('ctx-rename');
  if (ctxRename) {
    ctxRename.addEventListener('click', (e) => {
      e.stopPropagation();
      const contextMenu = document.getElementById('context-menu');
      if (contextMenu) contextMenu.style.display = 'none';
      if (!contextTargetFile) return;
      const newName = prompt("Enter new file name:", contextTargetFile);
      if (newName && newName.trim() !== "") {
        const file = files.find(f => f.name === contextTargetFile);
        if (file) {
          file.name = newName.trim();
          if (activeFile === contextTargetFile) activeFile = file.name;
          openFile(activeFile);
        }
      }
    });
  }

  const ctxDelete = document.getElementById('ctx-delete');
  if (ctxDelete) {
    ctxDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      const contextMenu = document.getElementById('context-menu');
      if (contextMenu) contextMenu.style.display = 'none';
      if (!contextTargetFile) return;
      if (confirm(`Are you sure you want to delete ${contextTargetFile}?`)) {
        const idx = files.findIndex(f => f.name === contextTargetFile);
        if (idx !== -1) {
          files.splice(idx, 1);
          if (files.length === 0) {
            files.push({ name: "untitled.txt", content: "" });
            activeFile = "untitled.txt";
          }
          if (activeFile === contextTargetFile) {
            openFile(files[0].name);
          } else {
            renderExplorer();
          }
        }
      }
    });
  }

  const chatInput = document.getElementById('chat-input');
  const btnChatSend = document.getElementById('btn-chat-send');
  const chatMessages = document.getElementById('chat-messages');

  function sendChatMessage() {
    if (!chatInput || !chatMessages) return;
    const text = chatInput.value.trim();
    if (!text) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = '8px';
    msgDiv.style.color = 'var(--on-surface)';
    msgDiv.style.fontSize = '13px';
    msgDiv.innerHTML = `<strong>👤 You:</strong> ${escapeHtml(text)}`;
    chatMessages.appendChild(msgDiv);
    
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => {
      const aiDiv = document.createElement('div');
      aiDiv.style.marginBottom = '8px';
      aiDiv.style.color = 'var(--on-surface-variant)';
      aiDiv.style.fontSize = '13px';
      aiDiv.innerHTML = `<strong>🤖 AI:</strong> Let me think about that... (Placeholder Response)`;
      chatMessages.appendChild(aiDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 600);
  }

  if (btnChatSend) {
    btnChatSend.addEventListener('click', sendChatMessage);
  }
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  const btnCloseStats = document.getElementById('btn-close-stats');
  const statsModal = document.getElementById('stats-modal');
  if (btnCloseStats && statsModal) {
    btnCloseStats.addEventListener('click', () => {
      statsModal.classList.remove('is-visible');
    });
  }
  if (statsModal) {
    statsModal.addEventListener('click', (e) => {
      if (e.target === statsModal) statsModal.classList.remove('is-visible');
    });
  }

})();
