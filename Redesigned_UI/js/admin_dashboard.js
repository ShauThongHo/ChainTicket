  /* ================= 1. Sign out ================= */
  document.getElementById("signOutBtn").addEventListener("click", () => {
    window.location.href = "homepage.html";
  });

  /* ================= 2. 5 个活动完整数据 ================= */
  const adminEventsData = [
    {
      id: 1,
      name: "KPOP CONCERT TICKET",
      status: "Active",
      statusClass: "active",
      extraBadges: ["0% checked in"],
      metrics: "SUC · sold 1/50 · gate 0 · vault 25.00 DxDAI",
      market: "0xd044...4dc9",
      vault: "0xdcb5...b229",
      collection: "0xfec9...922d",
      frozen: false,
      infoExpanded: false
    },
    {
      id: 2,
      name: "kuanghuanjie",
      status: "Active",
      statusClass: "active",
      extraBadges: ["0% checked in"],
      metrics: "WAN XIANG TING · sold 1/12 · gate 0 · vault 40.00 DxDAI",
      market: "0x8112...9a2c",
      vault: "0xf1ee...36bb",
      collection: "0xda73...e6d2",
      frozen: false,
      infoExpanded: false
    },
    {
      id: 3,
      name: "Test Event 3",
      status: "Ended",
      statusClass: "ended",
      extraBadges: ["0% checked in"],
      metrics: "115C · sold 1/12 · gate 0 · vault 10.00 DxDAI",
      market: "0x3895...6f1e",
      vault: "0x03bc...2375",
      collection: "0x6976...ae0d",
      frozen: false,
      infoExpanded: false
    },
    {
      id: 4,
      name: "Test 2",
      status: "Ended",
      statusClass: "ended",
      extraBadges: ["Vote 0/0", "0% checked in"],
      metrics: "115 · sold 0/12 · gate 0 · vault 0.00 DxDAI",
      market: "0xe687...c9b8",
      vault: "0x10f3...8833",
      collection: "0x8e47...8980",
      frozen: false,
      infoExpanded: false
    },
    {
      id: 5,
      name: "Test Event 1",
      status: "Ended",
      statusClass: "ended",
      extraBadges: ["Withdrawn", "0% checked in"],
      metrics: "115C · sold 1/12 · gate 0 · vault 0.00 DxDAI",
      market: "0x5113...1dc1",
      vault: "0x396b...bab7",
      collection: "0x4c57...502e",
      frozen: false,
      infoExpanded: false
    }
  ];

  /* ================= 3. 右侧 Signer Operations 10 条操作流水 ================= */
  const signerOpsData = [
    { action: "withdraw · Test Event 1", tx: "0xbc78309ae2..." },
    { action: "list · kuanghuanjie", tx: "0x92bf51e18b..." },
    { action: "buy_primary · kuanghuanjie", tx: "0x55f542f4c1..." },
    { action: "mint · kuanghuanjie", tx: "0x2bbd2b5c4f..." },
    { action: "buy_primary · KPOP CONCERT TICKET", tx: "0xfa7f6bad20..." },
    { action: "mint · KPOP CONCERT TICKET", tx: "0x4757cf62f3..." },
    { action: "buy_primary · Test Event 3", tx: "0x4bdc4d434d..." },
    { action: "mint · Test Event 3", tx: "0x726a95b481..." },
    { action: "mint · Test 2", tx: "0xa70503629b..." },
    { action: "unfreeze · Test Event 1", tx: "0xf8011b6023..." }
  ];

  /* ================= 4. Freeze / Unfreeze 链上交易弹窗控制器 ================= */
  const freezeTxModal = document.getElementById("freezeTxModal");
  const freezeModalTitle = document.getElementById("freezeModalTitle");
  const fStep1Icon = document.getElementById("fStep1Icon");
  const fStep1Text = document.getElementById("fStep1Text");
  const fStep1Status = document.getElementById("fStep1Status");
  const fStep2Icon = document.getElementById("fStep2Icon");
  const fStep2Text = document.getElementById("fStep2Text");
  const fStep2Status = document.getElementById("fStep2Status");
  const freezeModalActionBtn = document.getElementById("freezeModalActionBtn");

  let pendingFreezeEventId = null;
  let freezeTimers = [];

  function clearFreezeTimers() {
    freezeTimers.forEach(t => clearTimeout(t));
    freezeTimers = [];
  }

  function openFreezeTxModal(eventItem) {
    clearFreezeTimers();
    pendingFreezeEventId = eventItem.id;
    const willFreeze = !eventItem.frozen;

    freezeModalTitle.textContent = willFreeze
      ? `Freeze ${eventItem.name}`
      : `Unfreeze ${eventItem.name}`;

    fStep1Icon.innerHTML = `<span class="step-spinner"></span>`;
    fStep1Text.textContent = willFreeze
      ? "Confirm freeze in your wallet"
      : "Confirm unfreeze in your wallet";
    fStep1Text.classList.remove("muted");
    fStep1Status.textContent = "In progress";
    fStep1Status.className = "tx-step-status active";

    fStep2Icon.innerHTML = `<span class="step-pending-dot"></span>`;
    fStep2Text.textContent = willFreeze
      ? "Freeze contract on-chain"
      : "Restore contract on-chain";
    fStep2Text.classList.add("muted");
    fStep2Status.textContent = "Pending";
    fStep2Status.className = "tx-step-status";

    freezeModalActionBtn.disabled = true;
    freezeModalActionBtn.classList.remove("ready");
    freezeModalActionBtn.textContent = "Please wait";

    freezeTxModal.classList.add("open");

    freezeTimers.push(setTimeout(() => {
      fStep1Icon.innerHTML = `<span class="step-done-check">✓</span>`;
      fStep1Status.textContent = "Confirmed";
      fStep1Status.className = "tx-step-status done";

      fStep2Icon.innerHTML = `<span class="step-spinner"></span>`;
      fStep2Text.classList.remove("muted");
      fStep2Status.textContent = "In progress";
      fStep2Status.className = "tx-step-status active";
    }, 1300));

    freezeTimers.push(setTimeout(() => {
      fStep2Icon.innerHTML = `<span class="step-done-check">✓</span>`;
      fStep2Status.textContent = "Recorded";
      fStep2Status.className = "tx-step-status done";

      freezeModalActionBtn.disabled = false;
      freezeModalActionBtn.classList.add("ready");
      freezeModalActionBtn.textContent = "Done";

      if (pendingFreezeEventId !== null) {
        const target = adminEventsData.find(e => e.id === pendingFreezeEventId);
        if (target) {
          target.frozen = !target.frozen;
          const opPrefix = target.frozen ? "freeze" : "unfreeze";
          signerOpsData.unshift({
            action: `${opPrefix} · ${target.name}`,
            tx: "0x" + Math.random().toString(16).slice(2, 12) + "..."
          });
          renderAdminDashboard();
        }
      }
    }, 2600));
  }

  freezeModalActionBtn.addEventListener("click", () => {
    if (!freezeModalActionBtn.disabled) {
      clearFreezeTimers();
      freezeTxModal.classList.remove("open");
      pendingFreezeEventId = null;
    }
  });

  window.toggleEventFreeze = function(eventId) {
    const target = adminEventsData.find(e => e.id === eventId);
    if (!target) return;
    openFreezeTxModal(target);
  };

  /* ================= 5. 渲染 Events 列表与可折叠 Information 抽屉 ================= */
  const adminEventsList = document.getElementById("adminEventsList");
  const signerOpsList = document.getElementById("signerOpsList");
  const eventsCountTag = document.getElementById("eventsCountTag");
  const adminSearchInput = document.getElementById("adminSearchInput");

  let searchQuery = "";

  window.toggleInfoDrawer = function(eventId) {
    const target = adminEventsData.find(e => e.id === eventId);
    if (!target) return;
    target.infoExpanded = !target.infoExpanded;
    renderAdminDashboard();
  };

  window.copyContractText = function(btnEl, addr) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(addr).catch(() => {});
    }
    const prev = btnEl.textContent;
    btnEl.textContent = "✓";
    btnEl.style.color = "#6ee7b7";
    setTimeout(() => {
      btnEl.textContent = prev;
      btnEl.style.color = "";
    }, 1100);
  };

  function renderAdminDashboard() {
    const q = searchQuery.trim().toLowerCase();

    const filteredEvents = adminEventsData.filter(ev =>
      !q ||
      ev.name.toLowerCase().includes(q) ||
      ev.metrics.toLowerCase().includes(q) ||
      ev.market.toLowerCase().includes(q) ||
      ev.vault.toLowerCase().includes(q) ||
      ev.collection.toLowerCase().includes(q)
    );

    eventsCountTag.textContent = `${filteredEvents.length} of 5 Events`;

    adminEventsList.innerHTML = filteredEvents.map(ev => {
      const extraBadgesHtml = ev.extraBadges.map(b => {
        const cls = b === "Withdrawn" ? "withdrawn" : "neutral";
        return `<span class="ev-badge ${cls}">${b}</span>`;
      }).join("");

      const frozenBadgeHtml = ev.frozen
        ? `<span class="ev-badge frozen">FROZEN</span>`
        : "";

      const isOpen = ev.infoExpanded;

      return `
        <article class="admin-event-card ${ev.frozen ? 'is-frozen' : ''}">
          <div class="ev-card-main-row">
            <div>
              <div class="ev-badges-row">
                <span class="ev-badge ${ev.statusClass}">${ev.status}</span>
                ${frozenBadgeHtml}
                ${extraBadgesHtml}
              </div>

              <div class="ev-name">${ev.name}</div>
            </div>

            <div class="ev-right-controls">
              <button class="btn-info-toggle ${isOpen ? 'open' : ''}" type="button"
                onclick="toggleInfoDrawer(${ev.id})">
                ${isOpen ? "▼ Information" : "▶ Information"}
              </button>

              <button class="btn-freeze ${ev.frozen ? 'unfreeze-mode' : ''}" type="button"
                onclick="toggleEventFreeze(${ev.id})">
                ${ev.frozen ? "Unfreeze" : "Freeze"}
              </button>
            </div>
          </div>

          <!-- 可折叠 Information 抽屉（包含场馆/销量/金库信息 + 三个智能合约地址） -->
          <div class="ev-info-drawer ${isOpen ? 'open' : ''}">
            <div class="ev-info-inner">
              <div class="ev-metrics-drawer-line">${ev.metrics}</div>

              <div class="ev-contracts-row">
                <div class="contract-chip-item">
                  <span>Market:</span>
                  <a href="#" class="contract-addr-link" onclick="event.preventDefault(); alert('Market Contract: ${ev.market}')">${ev.market} ↗</a>
                  <button class="btn-copy-mini" type="button" title="Copy address" onclick="copyContractText(this, '${ev.market}')">⧉</button>
                </div>

                <div class="contract-chip-item">
                  <span>Vault:</span>
                  <a href="#" class="contract-addr-link" onclick="event.preventDefault(); alert('Vault Contract: ${ev.vault}')">${ev.vault} ↗</a>
                  <button class="btn-copy-mini" type="button" title="Copy address" onclick="copyContractText(this, '${ev.vault}')">⧉</button>
                </div>

                <div class="contract-chip-item">
                  <span>Collection (ERC-721):</span>
                  <a href="#" class="contract-addr-link" onclick="event.preventDefault(); alert('Collection Contract: ${ev.collection}')">${ev.collection} ↗</a>
                  <button class="btn-copy-mini" type="button" title="Copy address" onclick="copyContractText(this, '${ev.collection}')">⧉</button>
                </div>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    const filteredOps = signerOpsData.filter(op =>
      !q || op.action.toLowerCase().includes(q) || op.tx.toLowerCase().includes(q)
    );

    signerOpsList.innerHTML = filteredOps.map(op => `
      <div class="op-row">
        <div class="op-left">
          <span class="op-action-text">${op.action}</span>
          <span class="onchain-pill">on-chain</span>
        </div>
        <a href="#" class="op-tx-link" onclick="event.preventDefault(); alert('Viewing Transaction ${op.tx} on Explorer')">${op.tx}</a>
      </div>
    `).join("");
  }

  adminSearchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderAdminDashboard();
  });

  renderAdminDashboard();

  /* ================= 6. 统一暗黑翡翠拓扑波浪与星尘背景动效 ================= */
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");

  let width, height, dpr;
  let mouse = { x: -1000, y: -1000 };
  let smoothMouse = { x: -1000, y: -1000 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
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

  const stars = Array.from({ length: 85 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    baseX: Math.random() * width,
    baseY: Math.random() * height,
    r: 0.6 + Math.random() * 1.5,
    alpha: 0.15 + Math.random() * 0.45,
    vy: -(0.08 + Math.random() * 0.2),
    phase: Math.random() * Math.PI * 2,
    isMint: Math.random() > 0.35
  }));

  const RIBBON_LINES = 26;
  const RIBBON_SEGS = 100;

  function drawRibbons(t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

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

        if (smoothMouse.x > -500) {
          const dx = px - smoothMouse.x;
          const dy = py - smoothMouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 220 && dist > 0.1) {
            const f = Math.pow(1 - dist / 220, 2) * 24;
            px += (dx / dist) * f;
            py += (dy / dist) * f;
          }
        }

        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      const alpha = (0.02 + centerGlow * 0.065);
      ctx.strokeStyle = `rgba(110, 231, 183, ${alpha})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.restore();
  }

  let time = 0;

  function animate() {
    time += 0.015;
    ctx.clearRect(0, 0, width, height);

    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.08;
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.08;

    drawRibbons(time);

    stars.forEach(s => {
      s.phase += 0.02;
      s.baseY += s.vy;
      if (s.baseY < -10) {
        s.baseY = height + 10;
        s.y = s.baseY;
      }

      let targetX = s.baseX;
      let targetY = s.baseY;

      if (smoothMouse.x > -500) {
        const dx = s.x - smoothMouse.x;
        const dy = s.y - smoothMouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 180 && dist > 0.1) {
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
        ? `rgba(167, 243, 208, ${a})`
        : `rgba(255, 255, 255, ${a * 0.8})`;
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  animate();
