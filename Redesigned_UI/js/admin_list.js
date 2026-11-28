  /* ================= 1. Sign out ================= */
  document.getElementById("signOutBtn").addEventListener("click", () => {
    window.location.href = "homepage.html";
  });

  /* ================= 2. 生成内嵌高清晰度示例证件扫描件 (SVG Data URI) ================= */
  const samplePassportSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2920"/>
          <stop offset="100%" stop-color="#07120e"/>
        </linearGradient>
      </defs>
      <rect width="640" height="440" rx="20" fill="url(#bg)"/>
      <rect x="18" y="18" width="604" height="404" rx="14" fill="none" stroke="#6ee7b7" stroke-opacity="0.35" stroke-width="2"/>
      <rect x="38" y="38" width="564" height="44" rx="8" fill="#10b981" fill-opacity="0.16"/>
      <text x="54" y="66" fill="#86efac" font-family="monospace" font-size="18" font-weight="bold">REPUBLIC OF SINGAPORE · IDENTITY PASS</text>
      <rect x="42" y="106" width="142" height="178" rx="10" fill="#16382c" stroke="#6ee7b7" stroke-opacity="0.4"/>
      <circle cx="113" cy="168" r="32" fill="#6ee7b7" fill-opacity="0.45"/>
      <path d="M62 262 C62 222, 164 222, 164 262" fill="#6ee7b7" fill-opacity="0.45"/>
      <text x="210" y="132" fill="#9ca3af" font-family="monospace" font-size="13">SURNAME / GIVEN NAME</text>
      <text x="210" y="156" fill="#ffffff" font-family="monospace" font-size="21" font-weight="bold">HO ALEX TAN</text>
      <text x="210" y="196" fill="#9ca3af" font-family="monospace" font-size="13">DOCUMENT NO.</text>
      <text x="210" y="220" fill="#6ee7b7" font-family="monospace" font-size="20" font-weight="bold">S9001284A</text>
      <text x="210" y="260" fill="#9ca3af" font-family="monospace" font-size="13">NATIONALITY / EXPIRY</text>
      <text x="210" y="284" fill="#ffffff" font-family="monospace" font-size="17">SINGAPORE  ·  15/12/2027</text>
      <rect x="42" y="320" width="556" height="72" rx="8" fill="#040a08" stroke="#ffffff" stroke-opacity="0.1"/>
      <text x="58" y="350" fill="#86efac" font-family="monospace" font-size="14" letter-spacing="2">P&lt;SGPHO&lt;&lt;ALEX&lt;TAN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
      <text x="58" y="376" fill="#86efac" font-family="monospace" font-size="14" letter-spacing="2">S9001284A4SGP9604128M2712156&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;08</text>
    </svg>
  `)}`;

  /* ================= 3. KYC Submissions 完整数据 ================= */
  const kycSubmissionsData = [
    {
      id: 1,
      walletShort: "0xf5c8...4ede",
      walletFull: "0xf5c89a214b8091e4c3d72a61b08e94f3c11d4ede",
      refHash: "037625e96ab5...",
      submittedAt: "11/10/2026, 5:40:01 PM",
      expiryShort: "exp 2027-12-15",
      expiryDate: "15/12/2027",
      status: "approved",
      fullName: "Ho Alex Tan",
      idNumber: "S9001284A",
      nationality: "Singapore",
      docPhoto: samplePassportSvg
    }
  ];

  /* ================= 4. Verified Organizers 数据 ================= */
  const verifiedOrganizersData = [
    {
      label: "Demo Organizer",
      wallet: "0xb937...d78e",
      status: "approved",
      eventsCount: 5
    }
  ];

  /* ================= 5. KYC View 详情弹窗与图片放大灯箱 ================= */
  const kycDetailModal = document.getElementById("kycDetailModal");
  const kycModalContent = document.getElementById("kycModalContent");
  const closeKycModalBtn = document.getElementById("closeKycModalBtn");
  const photoLightbox = document.getElementById("photoLightbox");
  const lightboxImg = document.getElementById("lightboxImg");

  let activeKycFilterQuery = "";
  let activeKycFilterStatus = "Any";

  window.openKycDetailModal = function(kycId) {
    const item = kycSubmissionsData.find(k => k.id === kycId);
    if (!item) return;

    kycModalContent.innerHTML = `
      <div class="kyc-fields-col">
        <div class="kyc-field-item">
          <span class="kyc-field-lbl">Wallet Address</span>
          <span class="kyc-field-val">${item.walletFull}</span>
        </div>

        <div class="kyc-field-item">
          <span class="kyc-field-lbl">Ref</span>
          <span class="kyc-field-val" style="color:#86efac;">${item.refHash}</span>
        </div>

        <div class="kyc-field-pair">
          <div class="kyc-field-item">
            <span class="kyc-field-lbl">Name</span>
            <span class="kyc-field-val">${item.fullName}</span>
          </div>

          <div class="kyc-field-item">
            <span class="kyc-field-lbl">ID Number</span>
            <span class="kyc-field-val">${item.idNumber}</span>
          </div>
        </div>

        <div class="kyc-field-pair">
          <div class="kyc-field-item">
            <span class="kyc-field-lbl">Nationality</span>
            <span class="kyc-field-val">${item.nationality}</span>
          </div>

          <div class="kyc-field-item">
            <span class="kyc-field-lbl">Expiry date</span>
            <span class="kyc-field-val">${item.expiryDate}</span>
          </div>
        </div>

        <div class="kyc-decision-row">
          <button class="btn-kyc-accept" type="button" onclick="decideKycStatus(${item.id}, 'approved')">
            Accept
          </button>
          <button class="btn-kyc-reject" type="button" onclick="decideKycStatus(${item.id}, 'rejected')">
            Reject
          </button>
        </div>
      </div>

      <div class="kyc-photo-box" onclick="enlargeKycPhoto('${item.docPhoto}')" title="Click to enlarge photo">
        <img src="${item.docPhoto}" alt="Credential Scan">
        <span class="photo-zoom-badge">🔍 Click to enlarge</span>
      </div>
    `;

    kycDetailModal.classList.add("open");
  };

  window.closeKycDetailModal = function() {
    kycDetailModal.classList.remove("open");
  };

  window.decideKycStatus = function(kycId, newStatus) {
    const item = kycSubmissionsData.find(k => k.id === kycId);
    if (!item) return;
    item.status = newStatus;
    closeKycDetailModal();
    renderKycReceipt(activeKycFilterQuery, activeKycFilterStatus);
  };

  window.enlargeKycPhoto = function(src) {
    lightboxImg.src = src;
    photoLightbox.classList.add("open");
  };

  photoLightbox.addEventListener("click", () => {
    photoLightbox.classList.remove("open");
  });

  closeKycModalBtn.addEventListener("click", closeKycDetailModal);
  kycDetailModal.addEventListener("click", (e) => {
    if (e.target === kycDetailModal) closeKycDetailModal();
  });

  /* ================= 6. 文件夹展开与 GPU 合成层收据向上吐出动画 ================= */
  const archiveStage = document.getElementById("archiveStage");
  const receiptPaperSheet = document.getElementById("receiptPaperSheet");
  const folderKyc = document.getElementById("folderKyc");
  const folderOrganizers = document.getElementById("folderOrganizers");
  const kycActionPill = document.getElementById("kycActionPill");
  const orgActionPill = document.getElementById("orgActionPill");

  let activeFolder = null;

  function triggerReceiptPrintAnimation(isAmber) {
    receiptPaperSheet.classList.toggle("amber-sheet", isAmber);
    receiptPaperSheet.classList.remove("receipt-printing-anim");
    requestAnimationFrame(() => {
      receiptPaperSheet.classList.add("receipt-printing-anim");
    });
  }

  function renderKycReceipt(filterQuery = "", filterStatus = "Any") {
    activeKycFilterQuery = filterQuery;
    activeKycFilterStatus = filterStatus;

    const q = filterQuery.trim().toLowerCase();
    const filtered = kycSubmissionsData.filter(item => {
      const matchQ = !q ||
        item.walletShort.toLowerCase().includes(q) ||
        item.walletFull.toLowerCase().includes(q) ||
        item.refHash.toLowerCase().includes(q);
      const matchS = filterStatus === "Any" || item.status.toLowerCase() === filterStatus.toLowerCase();
      return matchQ && matchS;
    });

    const rowsHtml = filtered.length > 0
      ? filtered.map(item => {
          const statusCls =
            item.status === "approved" ? "badge-approved" :
            item.status === "rejected" ? "badge-rejected" : "badge-pending";

          return `
            <div class="registry-row-card">
              <div>
                <div class="reg-main-id">${item.walletShort}</div>
                <div class="reg-sub-meta">${item.refHash} · ${item.submittedAt} · ${item.expiryShort}</div>
              </div>
              <div class="reg-actions-grp">
                <span class="${statusCls}">${item.status}</span>
                <button class="btn-row-outline" type="button" onclick="openKycDetailModal(${item.id})">
                  View
                </button>
              </div>
            </div>
          `;
        }).join("")
      : `<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.45);font-size:0.84rem;">No matching KYC submissions found.</div>`;

    receiptPaperSheet.innerHTML = `
      <div class="receipt-top-bar">
        <h2 class="receipt-title">KYC Submissions</h2>
        <button class="btn-return-folders" type="button" onclick="closeFolders()">↓ Close Folder</button>
      </div>

      <div class="kyc-filter-box">
        <div class="kyc-row-top">
          <div class="f-group">
            <label class="f-label">Wallet or reference</label>
            <input class="f-input" type="text" id="kycQueryInput" value="${filterQuery}" placeholder="0x... or kyc ref">
          </div>

          <div class="f-group">
            <label class="f-label">Status</label>
            <select class="f-select" id="kycStatusSelect">
              <option value="Any" ${filterStatus === "Any" ? "selected" : ""}>Any</option>
              <option value="approved" ${filterStatus === "approved" ? "selected" : ""}>Approved</option>
              <option value="rejected" ${filterStatus === "rejected" ? "selected" : ""}>Rejected</option>
            </select>
          </div>

          <button class="btn-kyc-search" id="kycSearchBtn" type="button">Search</button>
        </div>

        <div class="kyc-row-bottom">
          <div class="f-group">
            <label class="f-label">From</label>
            <input class="f-input" type="date" id="kycFromDate">
          </div>
          <div class="f-group">
            <label class="f-label">To</label>
            <input class="f-input" type="date" id="kycToDate">
          </div>
        </div>
      </div>

      <div class="registry-rows-list">${rowsHtml}</div>
    `;

    document.getElementById("kycSearchBtn").addEventListener("click", () => {
      const qVal = document.getElementById("kycQueryInput").value;
      const sVal = document.getElementById("kycStatusSelect").value;
      renderKycReceipt(qVal, sVal);
    });
  }

  function renderOrganizersReceipt() {
    document.getElementById("orgCountBadge").textContent = verifiedOrganizersData.length;

    const listHtml = verifiedOrganizersData.map((org, idx) => `
      <div class="registry-row-card">
        <div>
          <div class="reg-main-id" style="font-family:inherit;">${org.label}</div>
          <div class="reg-sub-meta">${org.wallet}</div>
        </div>
        <div class="reg-actions-grp">
          <span class="${org.status === 'approved' ? 'badge-approved' : 'badge-rejected'}">${org.status}</span>
          <span style="font-family:monospace;font-size:0.78rem;color:rgba(255,255,255,0.55);">${org.eventsCount} events</span>
          <button class="btn-row-outline" type="button" onclick="toggleOrganizerRevoke(${idx})">
            ${org.status === "approved" ? "Revoke" : "Restore"}
          </button>
        </div>
      </div>
    `).join("");

    receiptPaperSheet.innerHTML = `
      <div class="receipt-top-bar">
        <h2 class="receipt-title">Verified Organizers</h2>
        <button class="btn-return-folders" type="button" onclick="closeFolders()">↓ Close Folder</button>
      </div>

      <div class="org-add-card">
        <div class="f-group">
          <label class="f-label" for="newOrgWallet">Organizer wallet</label>
          <input class="f-input" type="text" id="newOrgWallet" placeholder="0x...">
        </div>

        <div class="f-group">
          <label class="f-label" for="newOrgLabel">Label / name</label>
          <input class="f-input" type="text" id="newOrgLabel" placeholder="Venue company">
        </div>

        <button class="btn-add-organizer" id="addOrganizerBtn" type="button">Add Organizer</button>
      </div>

      <div class="registry-rows-list">${listHtml}</div>
    `;

    document.getElementById("addOrganizerBtn").addEventListener("click", () => {
      const wInp = document.getElementById("newOrgWallet");
      const lInp = document.getElementById("newOrgLabel");
      const w = wInp.value.trim();
      const l = lInp.value.trim();
      if (!w || !l) {
        alert("Please enter both Organizer wallet and Label / name.");
        return;
      }
      const shortWallet = w.length > 12 ? `${w.slice(0, 6)}...${w.slice(-4)}` : w;
      verifiedOrganizersData.unshift({
        label: l,
        wallet: shortWallet,
        status: "approved",
        eventsCount: 0
      });
      renderOrganizersReceipt();
    });
  }

  window.toggleOrganizerRevoke = function(idx) {
    const target = verifiedOrganizersData[idx];
    if (!target) return;
    target.status = target.status === "approved" ? "revoked" : "approved";
    renderOrganizersReceipt();
  };

  function openFolder(type) {
    activeFolder = type;
    archiveStage.classList.add("folder-open");

    folderKyc.classList.toggle("is-active-folder", type === "kyc");
    folderOrganizers.classList.toggle("is-active-folder", type === "organizers");

    kycActionPill.textContent = "Switch to Organizers ⇄";
    orgActionPill.textContent = "Switch to KYC ⇄";

    if (type === "kyc") {
      renderKycReceipt(activeKycFilterQuery, activeKycFilterStatus);
      triggerReceiptPrintAnimation(false);
    } else {
      renderOrganizersReceipt();
      triggerReceiptPrintAnimation(true);
    }
  }

  window.closeFolders = function() {
    activeFolder = null;
    archiveStage.classList.remove("folder-open");
    folderKyc.classList.remove("is-active-folder");
    folderOrganizers.classList.remove("is-active-folder");
    kycActionPill.textContent = "Open Folder →";
    orgActionPill.textContent = "Open Folder →";
  };

  folderKyc.addEventListener("click", () => {
    if (archiveStage.classList.contains("folder-open")) {
      openFolder(activeFolder === "kyc" ? "organizers" : "kyc");
    } else {
      openFolder("kyc");
    }
  });

  folderOrganizers.addEventListener("click", () => {
    if (archiveStage.classList.contains("folder-open")) {
      openFolder(activeFolder === "organizers" ? "kyc" : "organizers");
    } else {
      openFolder("organizers");
    }
  });

  kycActionPill.addEventListener("click", (e) => {
    e.stopPropagation();
    if (archiveStage.classList.contains("folder-open")) openFolder("organizers");
    else openFolder("kyc");
  });

  orgActionPill.addEventListener("click", (e) => {
    e.stopPropagation();
    if (archiveStage.classList.contains("folder-open")) openFolder("kyc");
    else openFolder("organizers");
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (photoLightbox.classList.contains("open")) {
        photoLightbox.classList.remove("open");
      } else if (kycDetailModal.classList.contains("open")) {
        closeKycDetailModal();
      } else if (archiveStage.classList.contains("folder-open")) {
        closeFolders();
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

    // 弹窗打开时自动降频后台 Canvas，保障前景弹窗交互零掉帧
    const isModalActive =
      kycDetailModal.classList.contains("open") ||
      photoLightbox.classList.contains("open");
    if (isModalActive && now - lastFrameTime < 50) return;
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
