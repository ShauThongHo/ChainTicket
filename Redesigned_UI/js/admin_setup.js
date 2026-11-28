  /* ================= 1. 通用 Toast 提示 & Sign out ================= */
  const setupToast = document.getElementById("setupToast");
  let toastTimer = null;

  function showToast(msg) {
    setupToast.textContent = msg;
    setupToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      setupToast.classList.remove("show");
    }, 2400);
  }

  document.getElementById("signOutBtn").addEventListener("click", () => {
    window.location.href = "homepage.html";
  });

  /* ================= 2. 两步交易进度确认弹窗控制器 ================= */
  const txProgressModal = document.getElementById("txProgressModal");
  const txModalTitle = document.getElementById("txModalTitle");
  const step1Icon = document.getElementById("step1Icon");
  const step1Text = document.getElementById("step1Text");
  const step1Status = document.getElementById("step1Status");
  const step2Icon = document.getElementById("step2Icon");
  const step2Text = document.getElementById("step2Text");
  const step2Status = document.getElementById("step2Status");
  const txModalActionBtn = document.getElementById("txModalActionBtn");

  let txTimers = [];

  function clearTxTimers() {
    txTimers.forEach(t => clearTimeout(t));
    txTimers = [];
  }

  function runTwoStepTxModal({ title, step1Label, step2Label, step2DoneLabel = "Recorded", onComplete }) {
    clearTxTimers();

    txModalTitle.textContent = title;
    step1Text.textContent = step1Label;
    step2Text.textContent = step2Label;

    step1Icon.innerHTML = `<span class="step-spinner"></span>`;
    step1Text.classList.remove("muted");
    step1Status.textContent = "In progress";
    step1Status.className = "tx-step-status active";

    step2Icon.innerHTML = `<span class="step-pending-dot"></span>`;
    step2Text.classList.add("muted");
    step2Status.textContent = "Pending";
    step2Status.className = "tx-step-status";

    txModalActionBtn.disabled = true;
    txModalActionBtn.classList.remove("ready");
    txModalActionBtn.textContent = "Please wait";

    txProgressModal.classList.add("open");

    txTimers.push(setTimeout(() => {
      step1Icon.innerHTML = `<span class="step-done-check">✓</span>`;
      step1Status.textContent = "Confirmed";
      step1Status.className = "tx-step-status done";

      step2Icon.innerHTML = `<span class="step-spinner"></span>`;
      step2Text.classList.remove("muted");
      step2Status.textContent = "In progress";
      step2Status.className = "tx-step-status active";
    }, 1100));

    txTimers.push(setTimeout(() => {
      step2Icon.innerHTML = `<span class="step-done-check">✓</span>`;
      step2Status.textContent = step2DoneLabel;
      step2Status.className = "tx-step-status done";

      txModalActionBtn.disabled = false;
      txModalActionBtn.classList.add("ready");
      txModalActionBtn.textContent = "Done";

      if (typeof onComplete === "function") onComplete();
    }, 2200));
  }

  function closeTxProgressModal() {
    clearTxTimers();
    txProgressModal.classList.remove("open");
  }

  txModalActionBtn.addEventListener("click", () => {
    if (!txModalActionBtn.disabled) closeTxProgressModal();
  });

  /* ================= 3. 持久化配置状态 ================= */
  const setupState = {
    kycDbUrl: "",
    kycAutoApprove: false,
    kycHostLabel: "database · ep-curly-dew-b3mfo4ou-pooler.c-4.ap-southeast-1.aws.neon.tech",

    mainDbUrl: "",
    dbStats: {
      events: 5,
      ticket_tiers: 5,
      tickets: 98,
      listings: 99,
      ledger: 13,
      organizers: 1,
      kyc: 0,
      kyc_public: 1,
      kyc_audit: 51,
      deployed_contracts: 17,
      admins: 1,
      withdraw_requests: 2
    },

    pinataJwt: "",
    pinataGateway: "https://dweb.link",

    networkPreset: "Gnosis Mainnet · 100",
    chainName: "Gnosis",
    nativeSymbol: "xDAI",
    chainId: "100",
    rpcUrl: "https://rpc.gnosischain.com",
    explorer: "https://gnosisscan.io",
    adminWallet: "0xE52A3EBcE46135CC10922Ee21494BBb12C82A921",
    operatorKey: "",
    signerSummary: "Signer 0xE52A...A921 · 0.0190 xDAI",

    faucetNative: false,
    royaltyPercent: "10"
  };

  /* ================= 4. 点击小文件夹始终居中展开的弹窗渲染 ================= */
  const folderModalBackdrop = document.getElementById("folderModalBackdrop");
  const receiptPaperSheet = document.getElementById("receiptPaperSheet");
  const allFolders = Array.from(document.querySelectorAll(".pocket-folder-item"));
  let activeFolderKey = null;

  function renderFolderSheet(key) {
    if (key === "kyc_db") {
      receiptPaperSheet.className = "receipt-paper-sheet";
      receiptPaperSheet.innerHTML = `
        <button class="btn-close-sheet" type="button" onclick="closeSetupFolder()" title="Close">✕</button>

        <div class="sheet-header-row">
          <h2 class="sheet-title">KYC Isolated Database</h2>
          <span class="sheet-endpoint-meta">${setupState.kycHostLabel}</span>
        </div>

        <div class="form-stack">
          <div class="f-group">
            <label class="f-label" for="kycDbUrlInput">DATABASE_URL_KYC</label>
            <input class="f-input" id="kycDbUrlInput" type="password" value="${setupState.kycDbUrl}" placeholder="postgres://••••">
          </div>

          <label class="checkbox-row">
            <input type="checkbox" id="kycAutoApproveChk" ${setupState.kycAutoApprove ? "checked" : ""}>
            <span>Auto-approve submissions (otherwise they stay pending).</span>
          </label>

          <div class="btn-row-wrap">
            <button class="btn-solid-mint" type="button" onclick="saveKycDbSettings()">Save KYC settings</button>
            <button class="btn-outline-glass" type="button" onclick="clearKycDbUrl()">Clear saved URL</button>
          </div>
        </div>
      `;
    } else if (key === "main_db") {
      receiptPaperSheet.className = "receipt-paper-sheet theme-cyan";
      const s = setupState.dbStats;
      receiptPaperSheet.innerHTML = `
        <button class="btn-close-sheet" type="button" onclick="closeSetupFolder()" title="Close">✕</button>

        <div class="sheet-header-row">
          <h2 class="sheet-title">Database</h2>
        </div>

        <div class="form-stack">
          <div class="f-group">
            <label class="f-label" for="mainDbUrlInput">DATABASE_URL</label>
            <input class="f-input" id="mainDbUrlInput" type="password" value="${setupState.mainDbUrl}" placeholder="postgres://••••"
              oninput="onMainDbInput(this.value)">
          </div>

          <div class="btn-row-wrap">
            <button class="btn-outline-glass" type="button" onclick="testMainDbConnection()">Test</button>
            <button class="btn-solid-mint" id="saveMainDbBtn" type="button" ${setupState.mainDbUrl ? "" : "disabled"} onclick="saveMainDbUrl()">Save</button>
          </div>

          <div class="db-tables-stats-grid">
            <div class="db-stat-cell"><span>events</span><strong>${s.events}</strong></div>
            <div class="db-stat-cell"><span>ticket_tiers</span><strong>${s.ticket_tiers}</strong></div>
            <div class="db-stat-cell"><span>tickets</span><strong>${s.tickets}</strong></div>

            <div class="db-stat-cell"><span>listings</span><strong>${s.listings}</strong></div>
            <div class="db-stat-cell"><span>ledger</span><strong>${s.ledger}</strong></div>
            <div class="db-stat-cell"><span>organizers</span><strong>${s.organizers}</strong></div>

            <div class="db-stat-cell"><span>kyc</span><strong>${s.kyc}</strong></div>
            <div class="db-stat-cell"><span>kyc_public</span><strong>${s.kyc_public}</strong></div>
            <div class="db-stat-cell"><span>kyc_audit</span><strong>${s.kyc_audit}</strong></div>

            <div class="db-stat-cell"><span>deployed_contracts</span><strong>${s.deployed_contracts}</strong></div>
            <div class="db-stat-cell"><span>admins</span><strong>${s.admins}</strong></div>
            <div class="db-stat-cell"><span>withdraw_requests</span><strong>${s.withdraw_requests}</strong></div>
          </div>
        </div>
      `;
    } else if (key === "ipfs") {
      receiptPaperSheet.className = "receipt-paper-sheet theme-violet";
      receiptPaperSheet.innerHTML = `
        <button class="btn-close-sheet" type="button" onclick="closeSetupFolder()" title="Close">✕</button>

        <div class="sheet-header-row">
          <h2 class="sheet-title">IPFS &amp; Pinata</h2>
        </div>

        <div class="form-stack">
          <div class="f-group">
            <label class="f-label" for="pinataJwtInput">Pinata JWT</label>
            <input class="f-input" id="pinataJwtInput" type="password" value="${setupState.pinataJwt}" placeholder="eyJ••••"
              oninput="onPinataJwtInput(this.value)">
          </div>

          <button class="btn-solid-mint btn-full-width" id="savePinataBtn" type="button"
            ${setupState.pinataJwt ? "" : "disabled"}
            onclick="savePinataJwt()">
            Save Pinata
          </button>

          <div class="f-group" style="margin-top: 4px;">
            <label class="f-label" for="pinataGatewayInput">IPFS read gateway</label>
            <input class="f-input" id="pinataGatewayInput" type="text" value="${setupState.pinataGateway}">
          </div>

          <button class="btn-outline-glass btn-full-width" type="button" onclick="saveIpfsGateway()">
            Save gateway
          </button>
        </div>
      `;
    } else if (key === "network") {
      receiptPaperSheet.className = "receipt-paper-sheet theme-amber";
      receiptPaperSheet.innerHTML = `
        <button class="btn-close-sheet" type="button" onclick="closeSetupFolder()" title="Close">✕</button>

        <div class="sheet-header-row">
          <h2 class="sheet-title">Network &amp; Signer</h2>
          <span class="sheet-endpoint-meta">${setupState.chainName} (ID ${setupState.chainId})</span>
        </div>

        <div class="form-stack">
          <div class="f-group">
            <label class="f-label" for="networkPresetSelect">Network preset</label>
            <select class="f-select" id="networkPresetSelect" onchange="onNetworkPresetChange(this.value)">
              <option value="Gnosis Mainnet · 100" ${setupState.networkPreset === "Gnosis Mainnet · 100" ? "selected" : ""}>Gnosis Mainnet · 100</option>
              <option value="Gnosis Chiado Testnet · 10200" ${setupState.networkPreset === "Gnosis Chiado Testnet · 10200" ? "selected" : ""}>Gnosis Chiado Testnet · 10200</option>
            </select>
          </div>

          <div class="form-grid-2">
            <div class="f-group">
              <label class="f-label" for="chainNameInput">Chain name</label>
              <input class="f-input" id="chainNameInput" type="text" value="${setupState.chainName}">
            </div>

            <div class="f-group">
              <label class="f-label" for="nativeSymbolInput">Native symbol</label>
              <input class="f-input" id="nativeSymbolInput" type="text" value="${setupState.nativeSymbol}">
            </div>
          </div>

          <div class="form-grid-2">
            <div class="f-group">
              <label class="f-label" for="chainIdInput">Chain ID</label>
              <input class="f-input" id="chainIdInput" type="text" value="${setupState.chainId}">
            </div>

            <div class="f-group">
              <label class="f-label" for="rpcUrlInput">RPC URL</label>
              <input class="f-input" id="rpcUrlInput" type="text" value="${setupState.rpcUrl}">
            </div>
          </div>

          <div class="f-group">
            <label class="f-label" for="explorerInput">Explorer</label>
            <input class="f-input" id="explorerInput" type="text" value="${setupState.explorer}">
          </div>

          <div class="f-group">
            <label class="f-label" for="adminWalletInput">Platform admin wallet</label>
            <input class="f-input" id="adminWalletInput" type="text" value="${setupState.adminWallet}">
          </div>

          <div class="f-group">
            <label class="f-label" for="operatorKeyInput">Operator private key</label>
            <input class="f-input" id="operatorKeyInput" type="password" value="${setupState.operatorKey}" placeholder="0x••••">
          </div>

          <div class="signer-sub-meta" id="signerSummaryMeta">${setupState.signerSummary}</div>

          <div class="btn-row-wrap">
            <button class="btn-outline-glass" type="button" onclick="pingRpcEndpoint()">Ping RPC</button>
            <button class="btn-solid-mint" type="button" onclick="saveNetworkSettings()">Save network</button>
          </div>
        </div>
      `;
    } else if (key === "reset") {
      receiptPaperSheet.className = "receipt-paper-sheet theme-crimson";
      receiptPaperSheet.innerHTML = `
        <button class="btn-close-sheet" type="button" onclick="closeSetupFolder()" title="Close">✕</button>

        <div class="sheet-header-row">
          <h2 class="sheet-title" style="color:#fda4af;">Reset Application Data</h2>
        </div>

        <div class="form-stack">
          <p style="font-size:0.84rem;line-height:1.6;color:rgba(255,255,255,0.68);">
            Permanently deletes app records, listings, and KYC data. On-chain contracts and balances remain untouched.
          </p>

          <div class="f-group">
            <label class="f-label" for="resetConfirmInput">Type RESET APPLICATION DATA to confirm</label>
            <div class="reset-inline-row">
              <input class="f-input" id="resetConfirmInput" type="text" placeholder="RESET APPLICATION DATA"
                oninput="document.getElementById('execResetBtn').disabled = (this.value.trim() !== 'RESET APPLICATION DATA')">
              <button class="btn-solid-crimson" id="execResetBtn" type="button" disabled onclick="executeResetData()">
                Clear app data
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  function openSetupFolder(key) {
    activeFolderKey = key;
    allFolders.forEach(f => {
      f.classList.toggle("is-active", f.dataset.folder === key);
    });

    renderFolderSheet(key);
    receiptPaperSheet.scrollTop = 0;

    requestAnimationFrame(() => {
      folderModalBackdrop.classList.add("open");
    });
  }

  window.closeSetupFolder = function() {
    if (!folderModalBackdrop.classList.contains("open")) return;
    folderModalBackdrop.classList.remove("open");
    activeFolderKey = null;
    allFolders.forEach(f => f.classList.remove("is-active"));
  };

  allFolders.forEach(folder => {
    folder.addEventListener("click", () => {
      openSetupFolder(folder.dataset.folder);
    });
  });

  folderModalBackdrop.addEventListener("click", (e) => {
    if (e.target === folderModalBackdrop) closeSetupFolder();
  });

  /* ================= 5. 表单操作回调 ================= */
  window.saveKycDbSettings = function() {
    setupState.kycDbUrl = document.getElementById("kycDbUrlInput").value;
    setupState.kycAutoApprove = document.getElementById("kycAutoApproveChk").checked;
    showToast("KYC database settings saved ✓");
  };

  window.clearKycDbUrl = function() {
    setupState.kycDbUrl = "";
    const inp = document.getElementById("kycDbUrlInput");
    if (inp) inp.value = "";
    showToast("Saved KYC URL cleared");
  };

  window.onMainDbInput = function(val) {
    setupState.mainDbUrl = val;
    const btn = document.getElementById("saveMainDbBtn");
    if (btn) btn.disabled = !val.trim();
  };

  window.testMainDbConnection = function() {
    showToast("PostgreSQL connection healthy (18ms) ✓");
  };

  window.saveMainDbUrl = function() {
    document.getElementById("statusDbBadge").textContent = "Connected";
    showToast("Database URL saved ✓");
  };

  window.onPinataJwtInput = function(val) {
    setupState.pinataJwt = val;
    const btn = document.getElementById("savePinataBtn");
    if (btn) btn.disabled = !val.trim();
  };

  window.savePinataJwt = function() {
    setupState.pinataJwt = document.getElementById("pinataJwtInput").value;
    document.getElementById("statusIpfsBadge").textContent = "Connected";
    showToast("Pinata JWT saved ✓");
  };

  window.saveIpfsGateway = function() {
    const gw = document.getElementById("pinataGatewayInput").value.trim();
    if (!gw) {
      showToast("Please enter an IPFS read gateway URL");
      return;
    }
    setupState.pinataGateway = gw;
    showToast("IPFS read gateway saved ✓");
  };

  window.onNetworkPresetChange = function(preset) {
    setupState.networkPreset = preset;
    if (preset.includes("10200")) {
      setupState.chainName = "Gnosis Chiado";
      setupState.chainId = "10200";
      setupState.rpcUrl = "https://rpc.chiadochain.net";
      setupState.explorer = "https://gnosis-chiado.blockscout.com";
    } else {
      setupState.chainName = "Gnosis";
      setupState.chainId = "100";
      setupState.rpcUrl = "https://rpc.gnosischain.com";
      setupState.explorer = "https://gnosisscan.io";
    }
    renderFolderSheet("network");
  };

  window.pingRpcEndpoint = function() {
    const rpc = document.getElementById("rpcUrlInput")?.value || setupState.rpcUrl;
    showToast(`RPC OK (${rpc}) · 42ms ✓`);
  };

  window.saveNetworkSettings = function() {
    setupState.chainName = document.getElementById("chainNameInput").value;
    setupState.nativeSymbol = document.getElementById("nativeSymbolInput").value;
    setupState.chainId = document.getElementById("chainIdInput").value;
    setupState.rpcUrl = document.getElementById("rpcUrlInput").value;
    setupState.explorer = document.getElementById("explorerInput").value;
    setupState.adminWallet = document.getElementById("adminWalletInput").value;
    setupState.operatorKey = document.getElementById("operatorKeyInput").value;
    document.getElementById("statusSignerBadge").textContent = "Ready";
    showToast("Network & Signer configuration saved ✓");
  };

  window.executeResetData = function() {
    Object.assign(setupState.dbStats, {
      events: 0,
      ticket_tiers: 0,
      tickets: 0,
      listings: 0,
      ledger: 0,
      kyc: 0,
      kyc_audit: 0,
      withdraw_requests: 0
    });
    showToast("App data cleared ✓");
    renderFolderSheet("main_db");
  };

  /* ================= 6. 右侧栏交互：点击 Use native xDAI 和 Update 触发两步进度弹窗 ================= */
  document.getElementById("faucetAddrLink").addEventListener("click", () => {
    navigator.clipboard?.writeText("0xd4fd812a94c10e7b5290f8a1e72c9043b811369d");
    showToast("Copied faucet address 0xd4fd...369d");
  });

  document.getElementById("useNativeXdaiBtn").addEventListener("click", (e) => {
    const switchingToNative = !setupState.faucetNative;
    const btn = e.currentTarget;

    runTwoStepTxModal({
      title: switchingToNative ? "Switch to native xDAI" : "Switch to Dev Faucet",
      step1Label: "Confirm gas token mode in your wallet",
      step2Label: "Update faucet settlement config",
      step2DoneLabel: "Updated",
      onComplete: () => {
        setupState.faucetNative = switchingToNative;
        const badge = document.getElementById("faucetModeBadge");
        if (setupState.faucetNative) {
          badge.textContent = "Native xDAI";
          badge.classList.add("warn");
          btn.textContent = "Switch to Dev Faucet";
        } else {
          badge.textContent = "Dev Active";
          badge.classList.remove("warn");
          btn.textContent = "Use native xDAI";
        }
      }
    });
  });

  document.getElementById("updateRoyaltyBtn").addEventListener("click", () => {
    const val = parseFloat(document.getElementById("royaltyPercentInput").value);
    if (!Number.isFinite(val) || val < 0 || val > 50) {
      showToast("Royalty must be between 0% and 50%");
      return;
    }

    runTwoStepTxModal({
      title: `Update resale royalty (${val}%)`,
      step1Label: "Confirm royalty rate in your wallet",
      step2Label: "Record new royalty cap on-chain",
      step2DoneLabel: "Recorded",
      onComplete: () => {
        setupState.royaltyPercent = String(val);
      }
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (txProgressModal.classList.contains("open")) {
        if (!txModalActionBtn.disabled) closeTxProgressModal();
      } else if (folderModalBackdrop.classList.contains("open")) {
        closeSetupFolder();
      }
    }
  });

  /* ================= 7. 高性能暗黑翡翠拓扑波浪与星尘背景动效 ================= */
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  let width, height, dpr;
  let mouse = { x: -1000, y: -1000 };
  let smoothMouse = { x: -1000, y: -1000 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener("mouseleave", () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  const stars = Array.from({ length: 65 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    baseX: Math.random() * width,
    baseY: Math.random() * height,
    r: 0.6 + Math.random() * 1.4,
    alpha: 0.16 + Math.random() * 0.42,
    vy: -(0.08 + Math.random() * 0.18),
    phase: Math.random() * Math.PI * 2,
    isMint: Math.random() > 0.35
  }));

  const RIBBON_LINES = 18;
  const RIBBON_SEGS = 64;

  function drawRibbons(t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 0.85;

    const hasMouse = smoothMouse.x > -500;

    for (let i = 0; i < RIBBON_LINES; i++) {
      const norm = (i / (RIBBON_LINES - 1)) - 0.5;
      const centerGlow = 1 - Math.abs(norm) * 2;

      ctx.beginPath();
      for (let s = 0; s <= RIBBON_SEGS; s++) {
        const u = s / RIBBON_SEGS;
        const bx = width * (0.25 + u * 0.85);
        const by = height * (0.95 - u * 0.88);

        const pinch = Math.sin(u * Math.PI * 2 - t * 0.4) * 0.45 + 0.75;
        const wave = Math.sin(u * 4.2 + t * 0.65 + norm * 3.0) * 48
                   + Math.cos(u * 6.5 - t * 0.45 + norm * 4.5) * 20;
        const offset = norm * (height * 0.26) * pinch + wave;

        let px = bx - offset * 0.45;
        let py = by + offset * 0.85;

        if (hasMouse) {
          const dx = px - smoothMouse.x;
          const dy = py - smoothMouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 48400 && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const f = Math.pow(1 - dist / 220, 2) * 24;
            px += (dx / dist) * f;
            py += (dy / dist) * f;
          }
        }

        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      const alpha = 0.024 + centerGlow * 0.075;
      ctx.strokeStyle = `rgba(110, 231, 183, ${alpha.toFixed(3)})`;
      ctx.stroke();
    }

    ctx.restore();
  }

  let time = 0;
  let lastFrameTime = 0;

  function animate(now) {
    requestAnimationFrame(animate);

    const isModalOpen =
      folderModalBackdrop.classList.contains("open") ||
      txProgressModal.classList.contains("open");
    if (isModalOpen && now - lastFrameTime < 50) return;
    lastFrameTime = now;

    time += 0.015;
    ctx.clearRect(0, 0, width, height);

    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.08;
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.08;

    drawRibbons(time);

    const hasMouse = smoothMouse.x > -500;

    stars.forEach(s => {
      s.phase += 0.02;
      s.baseY += s.vy;
      if (s.baseY < -10) {
        s.baseY = height + 10;
        s.y = s.baseY;
      }

      let targetX = s.baseX;
      let targetY = s.baseY;

      if (hasMouse) {
        const dx = s.x - smoothMouse.x;
        const dy = s.y - smoothMouse.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 32400 && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const push = Math.pow(1 - dist / 180, 2) * 35;
          targetX += (dx / dist) * push;
          targetY += (dy / dist) * push;
        }
      }

      s.x += (targetX - s.x) * 0.08;
      s.y += (targetY - s.y) * 0.08;

      const a = s.alpha * (0.65 + 0.35 * Math.sin(s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.isMint
        ? `rgba(167, 243, 208, ${a.toFixed(3)})`
        : `rgba(255, 255, 255, ${(a * 0.8).toFixed(3)})`;
      ctx.fill();
    });
  }

  requestAnimationFrame(animate);
