import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAILY_DIR = path.join(__dirname, "daily");
const PORT = process.env.PORT || 3000;

/**
 * 获取 daily 目录下的 md 文件列表，按日期降序
 */
function listDailyFiles() {
  if (!fs.existsSync(DAILY_DIR)) return [];
  return fs.readdirSync(DAILY_DIR)
    .filter(f => f.endsWith(".md") && !f.startsWith("."))
    .sort()
    .reverse()
    .map(name => {
      const match = name.match(/^(\d{4}-\d{2}-\d{2})-(morning|evening)\.md$/);
      const label = match
        ? `${match[1]} ${match[2] === "morning" ? "上午" : "晚上"}`
        : name.replace(".md", "");
      const slug = name.replace(".md", "");
      return { name, label, slug };
    });
}

function getHtmlPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="notion">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>科研 & 技术热点日报</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* ========== Theme Variables ========== */
    [data-theme="light"] {
      --bg: #f7f8fa; --card-bg: #ffffff; --text: #1a1a2e;
      --text-secondary: #555770; --text-muted: #8e90a6;
      --accent: #4361ee; --accent-light: #eef1ff;
      --border: #e8e8ed; --border-light: #f0f0f5;
      --sidebar-bg: #ffffff; --sidebar-hover: #f4f5f7;
      --header-bg: #1a1a2e; --header-text: #ffffff;
      --code-bg: #f5f6f8; --blockquote-bg: #f8f9fc;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
      --toc-active-bg: #eef1ff; --toc-active-border: #4361ee;
    }
    [data-theme="dark"] {
      --bg: #0f0f1a; --card-bg: #1a1a2e; --text: #e0e0eb;
      --text-secondary: #a0a0b8; --text-muted: #6e6e8a;
      --accent: #7c8cf5; --accent-light: #252540;
      --border: #2a2a40; --border-light: #222238;
      --sidebar-bg: #151525; --sidebar-hover: #22223a;
      --header-bg: #0a0a15; --header-text: #e0e0eb;
      --code-bg: #12122a; --blockquote-bg: #18182e;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.2);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
      --toc-active-bg: #252540; --toc-active-border: #7c8cf5;
    }
    [data-theme="notion"] {
      --bg: #ffffff; --card-bg: #ffffff; --text: #37352f;
      --text-secondary: #6b6b6b; --text-muted: #9b9a97;
      --accent: #2eaadc; --accent-light: #e9f6fc;
      --border: #e9e9e7; --border-light: #f1f1ef;
      --sidebar-bg: #fbfbfa; --sidebar-hover: #f1f1ef;
      --header-bg: #ffffff; --header-text: #37352f;
      --code-bg: #f7f6f3; --blockquote-bg: #f7f6f3;
      --shadow-sm: none; --shadow-md: none;
      --toc-active-bg: #e9f6fc; --toc-active-border: #2eaadc;
    }

    /* ========== Reset & Base ========== */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: 64px; }
    body {
      background: var(--bg); color: var(--text);
      line-height: 1.8; transition: background 0.3s, color 0.3s;
    }
    [data-theme="light"] body, [data-theme="dark"] body {
      font-family: "Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    [data-theme="notion"] body {
      font-family: "Noto Serif SC", "Georgia", "Songti SC", "SimSun", serif;
    }

    /* ========== Header ========== */
    .header {
      background: var(--header-bg); color: var(--header-text);
      height: 52px; padding: 0 20px;
      display: flex; align-items: center; justify-content: space-between;
      position: fixed; top: 0; left: 0; right: 0; z-index: 200;
      border-bottom: 1px solid var(--border);
    }
    [data-theme="notion"] .header { box-shadow: none; }
    [data-theme="light"] .header, [data-theme="dark"] .header { box-shadow: var(--shadow-md); }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-left h1 { font-size: 15px; font-weight: 600; white-space: nowrap; }
    .header-left h1 a { color: var(--header-text); text-decoration: none; }
    .header-right { display: flex; align-items: center; gap: 6px; }

    /* Header controls */
    .h-select {
      padding: 4px 24px 4px 8px; border-radius: 6px; font-size: 13px;
      border: 1px solid rgba(128,128,128,0.3); cursor: pointer;
      -webkit-appearance: none; appearance: none;
      background-color: transparent; color: var(--header-text);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23999' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 6px center;
    }
    .h-select option { background: var(--card-bg); color: var(--text); }
    .h-btn {
      width: 30px; height: 30px; border-radius: 6px; border: none;
      background: transparent; color: var(--header-text);
      font-size: 16px; cursor: pointer; display: flex;
      align-items: center; justify-content: center; transition: background 0.15s;
    }
    .h-btn:hover { background: rgba(128,128,128,0.2); }
    .h-btn:disabled { opacity: 0.25; cursor: default; }
    .h-btn:disabled:hover { background: transparent; }
    .theme-btns { display: flex; gap: 2px; margin-left: 8px; }
    .theme-btn {
      width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; transition: border-color 0.2s, transform 0.15s;
    }
    .theme-btn:hover { transform: scale(1.15); }
    .theme-btn.active { border-color: var(--accent); }
    .theme-btn[data-t="light"] { background: linear-gradient(135deg, #f7f8fa, #e0e0eb); }
    .theme-btn[data-t="dark"]  { background: linear-gradient(135deg, #1a1a2e, #0f0f1a); }
    .theme-btn[data-t="notion"]{ background: linear-gradient(135deg, #fff, #f7f6f3); border: 1px solid #ddd; }

    /* ========== Layout ========== */
    .layout { display: flex; margin-top: 52px; min-height: calc(100vh - 52px); }

    /* ========== TOC Sidebar ========== */
    .sidebar {
      width: 260px; min-width: 260px; background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      position: fixed; top: 52px; bottom: 0; left: 0;
      overflow-y: auto; overflow-x: hidden; z-index: 50;
      padding: 16px 0; transition: transform 0.3s, background 0.3s;
    }
    .sidebar::-webkit-scrollbar { width: 4px; }
    .sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    .sidebar-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 1px; color: var(--text-muted); padding: 0 20px 8px;
    }
    .toc-list { list-style: none; }
    .toc-item a {
      display: block; padding: 5px 20px; font-size: 13px; line-height: 1.5;
      color: var(--text-secondary); text-decoration: none;
      border-left: 3px solid transparent; transition: all 0.15s;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .toc-item[data-depth="2"] a { padding-left: 20px; font-weight: 500; }
    .toc-item[data-depth="3"] a { padding-left: 36px; font-size: 12px; }
    .toc-item[data-depth="4"] a { padding-left: 50px; font-size: 12px; }
    .toc-item a:hover { color: var(--text); background: var(--sidebar-hover); }
    .toc-item.active a {
      color: var(--accent); background: var(--toc-active-bg);
      border-left-color: var(--toc-active-border); font-weight: 600;
    }

    /* Mobile TOC toggle */
    .toc-toggle {
      display: none; position: fixed; bottom: 20px; left: 20px; z-index: 300;
      width: 44px; height: 44px; border-radius: 50%; border: none;
      background: var(--accent); color: #fff; font-size: 20px;
      cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.2);
      align-items: center; justify-content: center;
    }

    /* ========== Main Content ========== */
    .main { flex: 1; margin-left: 260px; padding: 32px 40px 80px; max-width: 100%; }
    .article {
      max-width: 780px; margin: 0 auto;
      background: var(--card-bg); border-radius: 10px;
      padding: 44px 53px; border: 1px solid var(--border);
      box-shadow: var(--shadow-sm); transition: background 0.3s;
      font-size: 16px; line-height: 2; letter-spacing: 0.01em;
    }
    [data-theme="notion"] .article { border: none; box-shadow: none; }

    /* ========== Typography ========== */
    .article h1 {
      font-size: 1.8em; font-weight: 700; margin-bottom: 16px;
      padding-bottom: 14px; border-bottom: 2px solid var(--accent);
      line-height: 1.35; letter-spacing: -0.01em;
    }
    .article h2 {
      font-size: 1.3em; font-weight: 600; margin-top: 2.2em; margin-bottom: 0.7em;
      padding-bottom: 8px; border-bottom: 1px solid var(--border-light);
      line-height: 1.4; color: var(--text);
    }
    .article h3 {
      font-size: 1.15em; font-weight: 600; margin-top: 1.6em; margin-bottom: 0.5em;
      color: var(--text);
    }
    .article h4 { font-size: 1em; font-weight: 600; margin-top: 1.3em; margin-bottom: 0.4em; }
    .article p { margin-bottom: 1em; color: var(--text); }
    .article li { margin-bottom: 0.35em; color: var(--text); }
    .article ul, .article ol { padding-left: 1.6em; margin-bottom: 1em; }

    /* Links */
    .article a { color: var(--accent); text-decoration: none; border-bottom: 1px solid transparent; }
    .article a:hover { border-bottom-color: var(--accent); }

    /* Blockquotes */
    .article blockquote {
      border-left: 3px solid var(--accent); background: var(--blockquote-bg);
      padding: 14px 20px; margin: 1.2em 0; border-radius: 0 6px 6px 0;
      color: var(--text-secondary);
    }

    /* Code */
    .article pre {
      background: var(--code-bg); border-radius: 8px; padding: 16px 20px;
      overflow-x: auto; margin: 1.2em 0; border: 1px solid var(--border);
      font-size: 13px; line-height: 1.6;
    }
    .article code {
      font-family: "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.88em;
    }
    .article :not(pre) > code {
      background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
    }

    /* Tables */
    .article table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 14px; }
    .article thead th {
      background: var(--blockquote-bg); font-weight: 600; text-align: left;
      padding: 10px 14px; border-bottom: 2px solid var(--border);
    }
    .article td { padding: 10px 14px; border-bottom: 1px solid var(--border-light); }
    .article tbody tr:hover { background: var(--sidebar-hover); }

    /* HR */
    .article hr { border: none; height: 1px; background: var(--border); margin: 2.5em 0; }
    /* Bold */
    .article strong { font-weight: 600; }

    /* Notion special: serif headings */
    [data-theme="notion"] .article h1,
    [data-theme="notion"] .article h2,
    [data-theme="notion"] .article h3 {
      font-family: "Noto Serif SC", "Georgia", serif;
    }

    /* ========== Loading / Empty ========== */
    .loading { display: flex; align-items: center; justify-content: center; min-height: 50vh; color: var(--text-muted); }
    .loading::before {
      content: ''; width: 18px; height: 18px; margin-right: 10px;
      border: 2px solid var(--border); border-top-color: var(--accent);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty { text-align: center; padding: 80px 20px; color: var(--text-muted); }

    /* ========== Responsive ========== */
    @media (max-width: 900px) {
      .sidebar { transform: translateX(-100%); width: 280px; z-index: 150; box-shadow: var(--shadow-md); }
      .sidebar.open { transform: translateX(0); }
      .main { margin-left: 0; padding: 24px 16px 60px; }
      .article { padding: 24px 20px; }
      [data-theme="notion"] .article { padding: 24px 20px; }
      .toc-toggle { display: flex; }
      .backdrop { display: none; position: fixed; inset: 0; z-index: 140; background: rgba(0,0,0,0.3); }
      .backdrop.show { display: block; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1><a href="/">科研 & 技术热点日报</a></h1>
    </div>
    <div class="header-right">
      <button class="h-btn" id="btnPrev" onclick="navigate(-1)" title="上一篇">&#8249;</button>
      <select class="h-select" id="fileSelect" onchange="navigateTo(this.value)"></select>
      <button class="h-btn" id="btnNext" onclick="navigate(1)" title="下一篇">&#8250;</button>
      <div class="theme-btns">
        <button class="theme-btn active" data-t="light" onclick="setTheme('light')" title="Light"></button>
        <button class="theme-btn" data-t="dark" onclick="setTheme('dark')" title="Dark"></button>
        <button class="theme-btn" data-t="notion" onclick="setTheme('notion')" title="Notion"></button>
      </div>
    </div>
  </div>

  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-title">目录</div>
      <ul class="toc-list" id="tocList"></ul>
    </aside>
    <div class="main">
      <div class="article loading" id="content">加载中...</div>
    </div>
  </div>

  <button class="toc-toggle" id="tocToggle" onclick="toggleSidebar()">&#9776;</button>
  <div class="backdrop" id="backdrop" onclick="toggleSidebar()"></div>

  <script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
  <script>
    /* ========== Globals ========== */
    const contentEl = document.getElementById('content');
    const selectEl  = document.getElementById('fileSelect');
    const tocList   = document.getElementById('tocList');
    const sidebar   = document.getElementById('sidebar');
    const backdrop  = document.getElementById('backdrop');
    let fileList = [], headingEls = [];

    /* ========== Theme ========== */
    function setTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.t === t));
    }
    (function() {
      const saved = localStorage.getItem('theme');
      if (saved) setTheme(saved);
    })();

    /* ========== Mobile sidebar ========== */
    function toggleSidebar() {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
    }

    /* ========== TOC generation ========== */
    function buildTOC() {
      tocList.innerHTML = '';
      headingEls = [];
      const headings = contentEl.querySelectorAll('h1, h2, h3');
      headings.forEach((h, i) => {
        const id = 'heading-' + i;
        h.id = id;
        headingEls.push(h);
        const depth = parseInt(h.tagName[1]);
        const li = document.createElement('li');
        li.className = 'toc-item';
        li.dataset.depth = depth;
        const a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = h.textContent;
        a.title = h.textContent;
        a.addEventListener('click', e => {
          e.preventDefault();
          h.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', location.pathname + '#' + id);
          if (window.innerWidth <= 900) toggleSidebar();
        });
        li.appendChild(a);
        tocList.appendChild(li);
      });
      updateActiveTOC();
    }

    /* ========== Active TOC tracking ========== */
    function updateActiveTOC() {
      if (headingEls.length === 0) return;
      const items = tocList.querySelectorAll('.toc-item');
      let activeIdx = 0;
      const offset = 80;
      for (let i = headingEls.length - 1; i >= 0; i--) {
        if (headingEls[i].getBoundingClientRect().top <= offset) { activeIdx = i; break; }
      }
      items.forEach((item, i) => item.classList.toggle('active', i === activeIdx));
      // scroll active TOC item into view in sidebar
      const activeItem = items[activeIdx];
      if (activeItem) {
        const rect = activeItem.getBoundingClientRect();
        const sidebarRect = sidebar.getBoundingClientRect();
        if (rect.top < sidebarRect.top + 60 || rect.bottom > sidebarRect.bottom - 20) {
          activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
      if (!scrollTicking) { requestAnimationFrame(() => { updateActiveTOC(); scrollTicking = false; }); scrollTicking = true; }
    });

    /* ========== File navigation ========== */
    async function init() {
      try {
        const res = await fetch('/api/list');
        fileList = await res.json();
        selectEl.innerHTML = '';
        if (fileList.length === 0) {
          selectEl.innerHTML = '<option value="">暂无日报</option>';
          contentEl.innerHTML = '<div class="empty">暂无日报文件</div>';
          contentEl.classList.remove('loading');
          return;
        }
        fileList.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.slug; opt.textContent = f.label;
          selectEl.appendChild(opt);
        });
        const pathSlug = location.pathname.replace(/^\\/daily\\//, '').replace(/\\/$/, '');
        const match = fileList.find(f => f.slug === pathSlug);
        if (match) { selectEl.value = match.slug; loadFile(match.slug); }
        else { navigateTo(fileList[0].slug); }
      } catch (e) {
        contentEl.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>';
        contentEl.classList.remove('loading');
      }
    }
    function navigateTo(slug) {
      if (!slug) return;
      history.pushState(null, '', '/daily/' + slug);
      selectEl.value = slug; loadFile(slug);
    }
    function navigate(dir) {
      const idx = fileList.findIndex(f => f.slug === selectEl.value) + dir;
      if (idx >= 0 && idx < fileList.length) navigateTo(fileList[idx].slug);
    }
    function updateNavButtons() {
      const idx = fileList.findIndex(f => f.slug === selectEl.value);
      document.getElementById('btnPrev').disabled = idx <= 0;
      document.getElementById('btnNext').disabled = idx >= fileList.length - 1;
    }
    async function loadFile(slug) {
      contentEl.className = 'article loading';
      contentEl.textContent = '加载中...';
      tocList.innerHTML = '';
      const label = fileList.find(f => f.slug === slug)?.label || slug;
      document.title = label + ' - 科研 & 技术热点日报';
      updateNavButtons();
      try {
        const res = await fetch('/api/content?file=' + encodeURIComponent(slug + '.md'));
        if (!res.ok) throw new Error('文件不存在');
        const md = await res.text();
        contentEl.innerHTML = marked.parse(md);
        contentEl.className = 'article';
        buildTOC();
        window.scrollTo(0, 0);
        // jump to hash if present
        if (location.hash) {
          const el = document.querySelector(location.hash);
          if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      } catch (e) {
        contentEl.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>';
        contentEl.className = 'article';
      }
    }

    /* Keyboard & popstate */
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });
    window.addEventListener('popstate', () => {
      const s = location.pathname.replace(/^\\/daily\\//, '').replace(/\\/$/, '');
      const m = fileList.find(f => f.slug === s);
      if (m) { selectEl.value = m.slug; loadFile(m.slug); }
    });

    init();
  </script>

  <!-- Tuning Panel -->
  <style>
    .tune-fab {
      position: fixed; bottom: 20px; right: 20px; z-index: 500;
      width: 44px; height: 44px; border-radius: 50%; border: none;
      background: var(--accent); color: #fff; font-size: 20px;
      cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
    }
    .tune-panel {
      display: none; position: fixed; bottom: 74px; right: 20px; z-index: 500;
      width: 320px; background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      padding: 20px; font-size: 13px; color: var(--text);
      max-height: 80vh; overflow-y: auto;
    }
    .tune-panel.open { display: block; }
    .tune-panel h3 { font-size: 14px; margin-bottom: 14px; font-weight: 600; }
    .tune-row { margin-bottom: 12px; }
    .tune-row label { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary); }
    .tune-row label span { font-family: monospace; color: var(--accent); }
    .tune-row input[type="range"] {
      width: 100%; height: 4px; -webkit-appearance: none; appearance: none;
      background: var(--border); border-radius: 2px; outline: none;
    }
    .tune-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 14px; height: 14px;
      background: var(--accent); border-radius: 50%; cursor: pointer;
    }
    .tune-row select {
      width: 100%; padding: 4px 8px; border: 1px solid var(--border);
      border-radius: 6px; background: var(--card-bg); color: var(--text);
      font-size: 12px;
    }
    .tune-export {
      margin-top: 14px; padding: 6px 12px; border: 1px solid var(--accent);
      border-radius: 6px; background: transparent; color: var(--accent);
      cursor: pointer; font-size: 12px; width: 100%;
    }
    .tune-export:hover { background: var(--accent); color: #fff; }
  </style>

  <button class="tune-fab" onclick="document.getElementById('tunePanel').classList.toggle('open')" title="调参面板">&#9881;</button>
  <div class="tune-panel" id="tunePanel">
    <h3>排版调参</h3>

    <div class="tune-row">
      <label>正文字号 <span id="v_fs">16</span>px</label>
      <input type="range" min="12" max="22" step="1" value="16"
        oninput="tune('fontSize',this.value+'px','v_fs',this.value)">
    </div>
    <div class="tune-row">
      <label>行高 <span id="v_lh">2.0</span></label>
      <input type="range" min="1.2" max="2.6" step="0.1" value="2.0"
        oninput="tune('lineHeight',this.value,'v_lh',this.value)">
    </div>
    <div class="tune-row">
      <label>字间距 <span id="v_ls">0.01</span>em</label>
      <input type="range" min="0" max="0.15" step="0.01" value="0.01"
        oninput="tune('letterSpacing',this.value+'em','v_ls',this.value)">
    </div>
    <div class="tune-row">
      <label>段落间距 <span id="v_pm">1</span>em</label>
      <input type="range" min="0.4" max="2.5" step="0.1" value="1"
        oninput="tuneRule('.article p','marginBottom',this.value+'em','v_pm',this.value)">
    </div>
    <div class="tune-row">
      <label>内容区宽度 <span id="v_mw">780</span>px</label>
      <input type="range" min="600" max="1100" step="20" value="780"
        oninput="tune('maxWidth',this.value+'px','v_mw',this.value)">
    </div>
    <div class="tune-row">
      <label>内边距 <span id="v_pd">44</span>px</label>
      <input type="range" min="16" max="80" step="4" value="44"
        oninput="tune('padding',this.value+'px '+Math.round(this.value*1.2)+'px','v_pd',this.value)">
    </div>
    <div class="tune-row">
      <label>标题字号(h2) <span id="v_h2">1.3</span>em</label>
      <input type="range" min="1.0" max="2.0" step="0.05" value="1.3"
        oninput="tuneRule('.article h2','fontSize',this.value+'em','v_h2',this.value)">
    </div>
    <div class="tune-row">
      <label>正文字体</label>
      <select onchange="tune('fontFamily',this.value)">
        <option value='"Noto Serif SC", Georgia, serif'>Noto Serif SC (宋体)</option>
        <option value='"Noto Sans SC", "Inter", sans-serif'>Noto Sans SC (黑体)</option>
        <option value='"Inter", -apple-system, sans-serif'>Inter (英文无衬线)</option>
        <option value='Georgia, "Noto Serif SC", serif'>Georgia (英文衬线)</option>
        <option value='"LXGW WenKai", cursive, serif'>LXGW WenKai (霞鹜文楷)</option>
        <option value='system-ui, sans-serif'>系统默认</option>
      </select>
    </div>

    <button class="tune-export" onclick="exportValues()">复制当前参数</button>
  </div>

  <script>
    function tune(prop, val, labelId, labelVal) {
      contentEl.style[prop] = val;
      if (labelId) document.getElementById(labelId).textContent = labelVal;
    }
    function tuneRule(selector, prop, val, labelId, labelVal) {
      contentEl.querySelectorAll(selector).forEach(el => el.style[prop] = val);
      if (labelId) document.getElementById(labelId).textContent = labelVal;
    }
    function exportValues() {
      const s = contentEl.style;
      const vals = {
        fontSize: s.fontSize || '16px',
        lineHeight: s.lineHeight || '2',
        letterSpacing: s.letterSpacing || '0.01em',
        maxWidth: s.maxWidth || '780px',
        padding: s.padding || '44px 53px',
        fontFamily: s.fontFamily || '"Noto Serif SC", Georgia, serif',
        paragraphMargin: contentEl.querySelector('p')?.style.marginBottom || '1em',
        h2FontSize: contentEl.querySelector('h2')?.style.fontSize || '1.3em',
      };
      const text = JSON.stringify(vals, null, 2);
      navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板！\\n\\n' + text));
    }
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 首页 → 重定向到最新日报
  if (pathname === "/" && req.method === "GET") {
    const files = listDailyFiles();
    if (files.length > 0) {
      res.writeHead(302, { Location: `/daily/${files[0].slug}` });
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getHtmlPage());
    }
    return;
  }

  // /daily/:slug → 渲染 HTML 页面（客户端根据 URL 加载对应文件）
  if (pathname.startsWith("/daily/") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getHtmlPage());
    return;
  }

  // API: 文件列表
  if (pathname === "/api/list" && req.method === "GET") {
    const files = listDailyFiles();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(files));
    return;
  }

  // API: 文件内容
  if (pathname === "/api/content" && req.method === "GET") {
    const filename = url.searchParams.get("file");
    if (!filename || filename.includes("..") || filename.includes("/")) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid filename");
      return;
    }
    const filePath = path.join(DAILY_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(content);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`\n🚀 日报预览服务器已启动`);
  console.log(`   📖 访问地址: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`   📂 日报目录: ${DAILY_DIR}`);
  console.log(`   按 Ctrl+C 停止服务器\n`);
});
