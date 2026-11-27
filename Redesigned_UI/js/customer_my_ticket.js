  /* ================= 1. 导航栏 Faucet 领水与 Sign out ================= */
  let currentBalance = 25.00;
  const navBalanceText = document.getElementById("navBalanceText");
  const claimFaucetBtn = document.getElementById("claimFaucetBtn");
  const claimBtnLabel = claimFaucetBtn.querySelector("span");
  const signOutBtn = document.getElementById("signOutBtn");

  function animateBalanceIncrease(fromVal, toVal, duration = 450) {
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const val = (fromVal + (toVal - fromVal) * ease).toFixed(2);
      navBalanceText.textContent = `${val} DxDAI`;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  claimFaucetBtn.addEventListener("click", () => {
    claimFaucetBtn.disabled = true;
    claimBtnLabel.textContent = "Claiming...";
    setTimeout(() => {
      const prev = currentBalance;
      currentBalance += 100.00;
      animateBalanceIncrease(prev, currentBalance);
      claimFaucetBtn.disabled = false;
      claimBtnLabel.textContent = "Claim 100 DxDAI";
    }, 350);
  });

  signOutBtn.addEventListener("click", () => {
    window.location.href = "homepage.html";
  });

  /* ================= 2. 通用两步链上交易进度弹窗控制器 ================= */
  const objectionModal = document.getElementById("objectionModal");
  const txModalTitle = document.getElementById("txModalTitle");
  const step1Icon = document.getElementById("step1Icon");
  const step1Text = document.getElementById("step1Text");
  const step1Status = document.getElementById("step1Status");
  const step2Icon = document.getElementById("step2Icon");
  const step2Text = document.getElementById("step2Text");
  const step2Status = document.getElementById("step2Status");
  const txModalActionBtn = document.getElementById("txModalActionBtn");

  let activeTxContext = null;
  let txTimers = [];

  function clearTxTimers() {
    txTimers.forEach(t => clearTimeout(t));
    txTimers = [];
  }

  function setStep1InProgress() {
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
  }

  function setStep1DoneStep2InProgress() {
    step1Icon.innerHTML = `<span class="step-done-check">✓</span>`;
    step1Status.textContent = "Confirmed";
    step1Status.className = "tx-step-status done";

    step2Icon.innerHTML = `<span class="step-spinner"></span>`;
    step2Text.classList.remove("muted");
    step2Status.textContent = "In progress";
    step2Status.className = "tx-step-status active";
  }

  function setAllStepsDone() {
    step2Icon.innerHTML = `<span class="step-done-check">✓</span>`;
    step2Status.textContent = (activeTxContext && activeTxContext.step2DoneLabel) || "Recorded";
    step2Status.className = "tx-step-status done";

    txModalActionBtn.disabled = false;
    txModalActionBtn.classList.add("ready");
    txModalActionBtn.textContent = "Done";

    if (activeTxContext && typeof activeTxContext.onComplete === "function") {
      activeTxContext.onComplete();
    }
  }

  function runTxProgressFlow({ title, step1Label, step2Label, step2DoneLabel = "Recorded", onComplete }) {
    clearTxTimers();
    activeTxContext = { step2DoneLabel, onComplete };
    txModalTitle.textContent = title;
    step1Text.textContent = step1Label;
    step2Text.textContent = step2Label;
    setStep1InProgress();
    objectionModal.classList.add("open");

    txTimers.push(setTimeout(() => {
      setStep1DoneStep2InProgress();
    }, 1200));

    txTimers.push(setTimeout(() => {
      setAllStepsDone();
    }, 2400));
  }

  function closeObjectionModal() {
    clearTxTimers();
    objectionModal.classList.remove("open");
    activeTxContext = null;
  }

  txModalActionBtn.addEventListener("click", () => {
    if (!txModalActionBtn.disabled) closeObjectionModal();
  });

  window.ObjectionModal = {
    open: (tokenId) => {
      txModalTitle.textContent = "Object to organizer payout";
      step1Text.textContent = "Confirm your objection in your wallet";
      step2Text.textContent = "Record your vote";
      activeTxContext = { step2DoneLabel: "Recorded", tokenId };
      clearTxTimers();
      setStep1InProgress();
      objectionModal.classList.add("open");
    },
    step1Done: setStep1DoneStep2InProgress,
    step2Done: setAllStepsDone,
    close: closeObjectionModal
  };

  /* ================= 3. 两个文件夹的活动数据 ================= */
  const passesData = [
    {
      tokenId: 1,
      folder: "unused",
      title: "KPOP CONCERT TICKET",
      tier: "General Admission",
      faceValue: "25.00 DxDAI",
      dateTime: "12/31/2026, 4:29:00 PM",
      venue: "SUC",
      theme: "crimson",
      statusText: "Active",
      stateType: "locked_upcoming",
      unlockCountdown: "Unlocks in 839h 40m",
      secondaryCap: "22.50 DxDAI - 27.50 DxDAI",
      listedPrice: null,
      artCaption: "KPOP LIVE · ADMIT ONE"
    },
    {
      tokenId: 2,
      folder: "unused",
      title: "Aurora Block Fest",
      tier: "Harbor Deck VIP",
      faceValue: "36.00 DxDAI",
      dateTime: "12/14/2026, 6:00:00 PM",
      venue: "Harbor Stage · Singapore",
      theme: "amber",
      statusText: "Listed",
      stateType: "listed",
      secondaryCap: "32.40 DxDAI - 39.60 DxDAI",
      listedPrice: "40.00 DxDAI",
      artCaption: "SECONDARY POOL · ESCROWED"
    },
    {
      tokenId: 3,
      folder: "unused",
      title: "Nebula Synth Live",
      tier: "VIP Backstage Pass",
      faceValue: "24.50 DxDAI",
      dateTime: "11/28/2026, 8:00:00 PM",
      venue: "Arena 04 · Tokyo",
      theme: "emerald",
      statusText: "Active",
      stateType: "ready",
      secondaryCap: "22.05 DxDAI - 26.95 DxDAI",
      listedPrice: null,
      artCaption: "VIP ACCESS · GATE READY"
    },
    {
      tokenId: 1,
      uid: "used-1",
      folder: "used",
      title: "Test Event 1",
      tier: "General Admission",
      faceValue: "10.00 DxDAI",
      dateTime: "2026/11/10 18:58:00",
      venue: "115C",
      theme: "violet",
      statusText: "Ended",
      stateType: "ended",
      hasProposal: true,
      objections: 0,
      totalTickets: 1,
      voted: false,
      artCaption: "NFT PASS · ADMIT ONE"
    },
    {
      tokenId: 3,
      uid: "used-3",
      folder: "used",
      title: "Test Event 3",
      tier: "General Admission",
      faceValue: "10.00 DxDAI",
      dateTime: "2026/11/24 14:56:00",
      venue: "115C",
      theme: "cyan",
      statusText: "Ended",
      stateType: "ended",
      hasProposal: false,
      objections: 0,
      totalTickets: 1,
      voted: false,
      artCaption: "EVENT TICKET · QR VERIFIED"
    }
  ];

  document.getElementById("unusedCountBadge").textContent =
    passesData.filter(p => p.folder === "unused").length;
  document.getElementById("usedCountBadge").textContent =
    passesData.filter(p => p.folder === "used").length;

  /* ================= 4. 电脑端 & 手机端共用：点击卡片 3D 翻转展开变大详情弹窗 ================= */
  const passDetailBackdrop = document.getElementById("passDetailBackdrop");
  const passDetailModal = document.getElementById("passDetailModal");
  let inspectedKey = null;
  let lastClickedCardEl = null;
  let isResellFormOpen = false;
  let resellInputVal = "";

  function getItemKey(item) {
    return item.uid || `${item.folder}-${item.tokenId}`;
  }

  function parseFaceNum(faceStr) {
    const n = parseFloat(String(faceStr).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 25.00;
  }

  function renderDetailModal(item) {
    inspectedKey = getItemKey(item);
    const faceNum = parseFaceNum(item.faceValue);
    const minCap = +(faceNum * 0.9).toFixed(2);
    const maxCap = +(faceNum * 1.1).toFixed(2);

    let leftGateHtml = "";
    if (item.stateType === "listed") {
      leftGateHtml = `
        <div class="dmodal-gate-box resale-box">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>
            <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
          </svg>
          <div style="font-size:0.84rem;font-weight:600;color:#fde68a;">Listed for Resale</div>
          <div style="font-size:0.72rem;line-height:1.45;color:rgba(255,255,255,0.56);">
            Entry barcode is locked while this pass is listed in the secondary pool.
          </div>
        </div>
      `;
    } else if (item.stateType === "locked_upcoming") {
      leftGateHtml = `
        <div class="dmodal-gate-box">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div style="font-size:0.84rem;font-weight:600;color:#ffffff;">Gate Pass Locked</div>
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.52);">QR unlocks 2 hours before doors.</div>
          <span class="unlock-countdown-pill">🕒 ${item.unlockCountdown}</span>
        </div>
      `;
    } else if (item.stateType === "ready") {
      leftGateHtml = `
        <div class="dmodal-gate-box ready-box">
          <div class="qr-matrix" style="width:62px;height:62px;">
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
          </div>
          <div style="font-size:0.84rem;font-weight:600;color:#86efac;">Dynamic QR Active</div>
          <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);">Refreshes every 15s</div>
        </div>
      `;
    } else {
      leftGateHtml = `
        <div class="dmodal-gate-box">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div style="font-size:0.84rem;font-weight:600;color:#ffffff;">Gate Pass Locked</div>
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.52);">Event has ended.</div>
        </div>
      `;
    }

    let rightBottomHtml = "";
    if (item.stateType === "listed") {
      rightBottomHtml = `
        <div class="dmodal-action-box resale-highlight">
          <span style="font-family:monospace;font-size:0.88rem;color:#ffffff;">
            Listed at <strong style="color:#fde68a;">${item.listedPrice}</strong>
          </span>
          <button class="btn-modal-outline" type="button" onclick="handleDelistPass('${inspectedKey}')">Delist Pass</button>
        </div>
      `;
    } else if (item.stateType === "locked_upcoming" || item.stateType === "ready") {
      if (isResellFormOpen) {
        const currentValStr = resellInputVal || faceNum.toFixed(2);
        const numericVal = parseFloat(currentValStr);
        const isValid = Number.isFinite(numericVal) && numericVal >= minCap && numericVal <= maxCap;
        const isMinusActive = Math.abs(numericVal - minCap) < 0.005;
        const isFaceActive = Math.abs(numericVal - faceNum) < 0.005;
        const isPlusActive = Math.abs(numericVal - maxCap) < 0.005;

        rightBottomHtml = `
          <div class="resell-inline-panel" id="resellInlinePanel">
            <div class="resell-panel-header">
              <span class="resell-panel-title">Secondary Listing (90%~110% Cap)</span>
              <button class="btn-resell-cancel" type="button" onclick="toggleResellForm('${inspectedKey}', false)">Cancel</button>
            </div>

            <div class="resell-controls-row">
              <div class="resell-left-controls">
                <div class="resell-price-box ${isValid ? '' : 'invalid'}" id="resellPriceBox">
                  <input class="resell-price-input" id="resellPriceInput" type="number" step="0.01"
                    min="${minCap}" max="${maxCap}" value="${currentValStr}"
                    oninput="onResellPriceInput(this.value, ${minCap}, ${maxCap}, ${faceNum})">
                  <span class="resell-currency-unit">DxDAI</span>
                </div>

                <div class="resell-preset-grp">
                  <button class="btn-resell-preset ${isMinusActive ? 'active' : ''}" id="presetMinusBtn" type="button"
                    onclick="applyResellPreset(${minCap}, ${minCap}, ${maxCap}, ${faceNum})">-10%</button>
                  <button class="btn-resell-preset ${isFaceActive ? 'active' : ''}" id="presetFaceBtn" type="button"
                    onclick="applyResellPreset(${faceNum}, ${minCap}, ${maxCap}, ${faceNum})">Face</button>
                  <button class="btn-resell-preset ${isPlusActive ? 'active' : ''}" id="presetPlusBtn" type="button"
                    onclick="applyResellPreset(${maxCap}, ${minCap}, ${maxCap}, ${faceNum})">+10%</button>
                </div>
              </div>

              <button class="btn-list-pass-submit" id="confirmListPassBtn" type="button"
                ${isValid ? '' : 'disabled'}
                onclick="confirmListPass('${inspectedKey}', ${minCap}, ${maxCap})">
                List Pass
              </button>
            </div>

            <div class="resell-cap-hint ${isValid ? '' : 'error'}" id="resellCapHint">
              ${isValid
                ? `Allowed price range: ${minCap.toFixed(2)} – ${maxCap.toFixed(2)} DxDAI`
                : `Price must be between ${minCap.toFixed(2)} and ${maxCap.toFixed(2)} DxDAI`}
            </div>
          </div>
        `;
      } else {
        rightBottomHtml = `
          <div class="dmodal-footer-bar">
            <span class="cap-label">Secondary Cap: ${item.secondaryCap}</span>
            <button class="btn-modal-outline" type="button" onclick="toggleResellForm('${inspectedKey}', true)">🏷 Resell Pass</button>
          </div>
        `;
      }
    } else if (item.hasProposal) {
      rightBottomHtml = `
        <div class="dmodal-proposal-card">
          <div class="proposal-title-row">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>Organizer Payout Proposal (pending vote)</span>
          </div>
          <div class="proposal-sub-desc">
            Objections recorded: <strong>${item.objections} / ${item.totalTickets}</strong> tickets (1/3 threshold triggers governance freeze).
          </div>
          <div class="proposal-btn-wrap">
            <button class="btn-modal-amber ${item.voted ? 'voted' : ''}" type="button"
              ${item.voted ? "disabled" : ""}
              onclick="submitObjectionVote('${inspectedKey}')">
              ${item.voted ? "✓ Objection Vote Recorded" : "Submit Objection Vote"}
            </button>
          </div>
        </div>
      `;
    } else {
      rightBottomHtml = `
        <div class="dmodal-footer-bar">
          <span class="cap-label">On-Chain Attendance Verified</span>
        </div>
      `;
    }

    const badgeClass =
      item.stateType === "listed" ? "listed" :
      item.stateType === "ended" ? "ended" : "active";

    passDetailModal.innerHTML = `
      <button class="modal-close-btn" type="button" onclick="closeDetailModal()" title="Close">✕</button>

      <div class="dmodal-left">
        <div class="dmodal-art" data-theme="${item.theme}">
          <div class="folder-halftone"></div>
          <span class="nft-corner-tag">NFT #${item.tokenId}</span>
          <span class="art-caption">${item.artCaption}</span>
        </div>

        ${leftGateHtml}

        <div class="hmac-footer">HMAC-SHA256 Encrypted Verification</div>
      </div>

      <div class="dmodal-right">
        <div>
          <div class="dmodal-top-row">
            <div class="tag-row">
              <span class="d-badge ${badgeClass}">${item.statusText}</span>
              <span class="d-badge owned">OWNED</span>
              <span class="d-badge tier">${item.tier}</span>
            </div>
            <div class="face-price-text">Face: <strong>${item.faceValue}</strong></div>
          </div>

          <h2 class="dmodal-title">${item.title}</h2>

          <div class="dmodal-meta-line">
            <span>📅 ${item.dateTime}</span>
            <span>·</span>
            <span>📍 ${item.venue}</span>
          </div>

          <div class="dmodal-links-line">
            <a href="#" class="chain-ext-link" onclick="event.preventDefault(); alert('Viewing ERC-721 Token #${item.tokenId} on Block Explorer')">Token #${item.tokenId} ↗</a>
            <a href="#" class="chain-ext-link" onclick="event.preventDefault(); alert('Opening IPFS Metadata for Token #${item.tokenId}')">Decentralized Metadata ↗</a>
          </div>
        </div>

        ${rightBottomHtml}
      </div>
    `;
  }

  function syncResellControlsUI(val, minCap, maxCap, faceNum) {
    const num = parseFloat(val);
    const isValid = Number.isFinite(num) && num >= minCap && num <= maxCap;

    const box = document.getElementById("resellPriceBox");
    const submitBtn = document.getElementById("confirmListPassBtn");
    const hint = document.getElementById("resellCapHint");
    const minusBtn = document.getElementById("presetMinusBtn");
    const faceBtn = document.getElementById("presetFaceBtn");
    const plusBtn = document.getElementById("presetPlusBtn");

    if (box) box.classList.toggle("invalid", !isValid);
    if (submitBtn) submitBtn.disabled = !isValid;
    if (hint) {
      hint.classList.toggle("error", !isValid);
      hint.textContent = isValid
        ? `Allowed price range: ${minCap.toFixed(2)} – ${maxCap.toFixed(2)} DxDAI`
        : `Price must be between ${minCap.toFixed(2)} and ${maxCap.toFixed(2)} DxDAI`;
    }
    if (minusBtn) minusBtn.classList.toggle("active", isValid && Math.abs(num - minCap) < 0.005);
    if (faceBtn)  faceBtn.classList.toggle("active", isValid && Math.abs(num - faceNum) < 0.005);
    if (plusBtn)  plusBtn.classList.toggle("active", isValid && Math.abs(num - maxCap) < 0.005);
  }

  window.onResellPriceInput = function(val, minCap, maxCap, faceNum) {
    resellInputVal = val;
    syncResellControlsUI(val, minCap, maxCap, faceNum);
  };

  window.applyResellPreset = function(targetVal, minCap, maxCap, faceNum) {
    const formatted = targetVal.toFixed(2);
    resellInputVal = formatted;
    const input = document.getElementById("resellPriceInput");
    if (input) input.value = formatted;
    syncResellControlsUI(formatted, minCap, maxCap, faceNum);
  };

  window.toggleResellForm = function(key, open) {
    const item = passesData.find(p => getItemKey(p) === key);
    if (!item) return;
    isResellFormOpen = open;
    resellInputVal = open ? parseFaceNum(item.faceValue).toFixed(2) : "";
    renderDetailModal(item);
    if (open) {
      const input = document.getElementById("resellPriceInput");
      if (input) {
        input.focus();
        input.select();
      }
    }
  };

  window.confirmListPass = function(key, minCap, maxCap) {
    const item = passesData.find(p => getItemKey(p) === key);
    if (!item) return;
    const input = document.getElementById("resellPriceInput");
    const num = parseFloat(input ? input.value : resellInputVal);
    if (!Number.isFinite(num) || num < minCap || num > maxCap) return;

    const formattedPrice = `${num.toFixed(2)} DxDAI`;

    runTxProgressFlow({
      title: "List pass for resale",
      step1Label: "Confirm listing in your wallet",
      step2Label: "Publish listing on-chain",
      step2DoneLabel: "Listed",
      onComplete: () => {
        item.stateType = "listed";
        item.statusText = "Listed";
        item.listedPrice = formattedPrice;
        isResellFormOpen = false;
        resellInputVal = "";

        if (inspectedKey === key) renderDetailModal(item);
        if (currentFolderType) {
          if (window.innerWidth >= 821) buildDesktopLoopCarousel(currentFolderType, false);
          else renderMobileWalletStack(currentFolderType, false);
        }
      }
    });
  };

  function computeCardFlipTransform(cardEl, rotX = -16, rotY = 14) {
    if (!cardEl) {
      return `perspective(1200px) translate3d(0px, 24px, 0px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.62)`;
    }
    const src = cardEl.getBoundingClientRect();
    const dst = passDetailModal.getBoundingClientRect();
    if (!dst.width || !dst.height) {
      return `perspective(1200px) translate3d(0px, 24px, 0px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.62)`;
    }

    const srcCx = src.left + src.width / 2;
    const srcCy = src.top + src.height / 2;
    const dstCx = dst.left + dst.width / 2;
    const dstCy = dst.top + dst.height / 2;

    const dx = srcCx - dstCx;
    const dy = srcCy - dstCy;
    const uniformScale = Math.max(0.42, Math.min(0.75, ((src.width / dst.width) + (src.height / dst.height)) / 2));

    return `perspective(1200px) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${uniformScale.toFixed(3)})`;
  }

  window.openDetailModal = function(key, cardEl) {
    const item = passesData.find(p => getItemKey(p) === key);
    if (!item) return;

    lastClickedCardEl = cardEl || null;
    isResellFormOpen = false;
    resellInputVal = "";
    isLoopPaused = true;
    renderDetailModal(item);

    passDetailModal.style.transition = "none";
    passDetailBackdrop.classList.add("open");

    const startTransform = computeCardFlipTransform(lastClickedCardEl, -18, 16);
    passDetailModal.style.transform = startTransform;
    passDetailModal.style.opacity = "0";

    passDetailModal.offsetHeight;

    requestAnimationFrame(() => {
      passDetailModal.style.transition =
        "transform 0.44s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)";
      passDetailModal.style.transform =
        "perspective(1200px) translate3d(0px, 0px, 0px) rotateX(0deg) rotateY(0deg) scale(1)";
      passDetailModal.style.opacity = "1";
    });
  };

  window.closeDetailModal = function() {
    if (!passDetailBackdrop.classList.contains("open")) return;

    const endTransform = computeCardFlipTransform(lastClickedCardEl, 14, -14);
    passDetailModal.style.transition =
      "transform 0.32s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.24s ease";
    passDetailModal.style.transform = endTransform;
    passDetailModal.style.opacity = "0";
    passDetailBackdrop.classList.remove("open");

    inspectedKey = null;
    isResellFormOpen = false;
    resellInputVal = "";
    isLoopPaused = false;
  };

  window.handleDelistPass = function(key) {
    const item = passesData.find(p => getItemKey(p) === key);
    if (!item) return;

    runTxProgressFlow({
      title: "Delist pass from resale",
      step1Label: "Confirm delisting in your wallet",
      step2Label: "Remove listing on-chain",
      step2DoneLabel: "Delisted",
      onComplete: () => {
        item.stateType = "ready";
        item.statusText = "Active";
        item.listedPrice = null;
        isResellFormOpen = false;

        if (inspectedKey === key) renderDetailModal(item);
        if (currentFolderType) {
          if (window.innerWidth >= 821) buildDesktopLoopCarousel(currentFolderType, false);
          else renderMobileWalletStack(currentFolderType, false);
        }
      }
    });
  };

  passDetailBackdrop.addEventListener("click", (e) => {
    if (e.target === passDetailBackdrop) closeDetailModal();
  });

  /* ================= 5. 电脑端无限循环轨道 + 手机端从上往下铺满卡片栈 ================= */
  const archiveStage = document.getElementById("archiveStage");
  const desktopFolderLabel = document.getElementById("desktopFolderLabel");
  const desktopCarouselViewport = document.getElementById("desktopCarouselViewport");
  const desktopCarouselTrack = document.getElementById("desktopCarouselTrack");
  const desktopCollapseBtn = document.getElementById("desktopCollapseBtn");

  const folderUnused = document.getElementById("folderUnused");
  const folderUsed = document.getElementById("folderUsed");
  const unusedHintPill = document.getElementById("unusedHintPill");
  const usedHintPill = document.getElementById("usedHintPill");

  const walletOverlay = document.getElementById("walletOverlay");
  const walletCardsStack = document.getElementById("walletCardsStack");
  const closeWalletBtn = document.getElementById("closeWalletBtn");

  let currentFolderType = null;
  let mobileCloseTimer = null;

  let loopCards = [];
  let loopScrollX = 0;
  let loopStride = 300;
  let loopTotalWidth = 0;
  let isLoopPaused = false;
  let isLoopDragging = false;
  let wasLoopDragged = false;
  let loopDragStartX = 0;
  let loopDragStartScroll = 0;

  function buildDesktopLoopCarousel(folderType, animatePop = true) {
    const baseList = passesData.filter(p => p.folder === folderType);
    desktopFolderLabel.textContent =
      folderType === "unused"
        ? `Unused Passes (${baseList.length}) · Click any pass to inspect`
        : `Used & History (${baseList.length}) · Click any pass to inspect`;

    let repeatedList = [];
    while (repeatedList.length < 6) {
      repeatedList = repeatedList.concat(baseList);
    }

    loopTotalWidth = repeatedList.length * loopStride;
    if (animatePop) loopScrollX = 0;

    desktopCarouselTrack.innerHTML = repeatedList.map((item, idx) => {
      const k = getItemKey(item);
      return `
        <article class="desktop-loop-card ${animatePop ? 'popping-out' : ''}"
          data-theme="${item.theme}"
          data-key="${k}"
          style="animation-delay: ${Math.min(idx, 4) * 0.06}s;">
          <div class="folder-halftone"></div>
          <div>
            <div class="wcard-header">
              <div>
                <div class="wcard-brand">NFT #${item.tokenId} · ${item.statusText}</div>
                <h3 class="wcard-title">${item.title}</h3>
              </div>
              <span class="wcard-tier-pill">${item.tier}</span>
            </div>

            <div class="wcard-sub-meta">
              <span>📅 ${item.dateTime}</span>
            </div>
            <div class="wcard-sub-meta">
              <span>📍 ${item.venue}</span>
            </div>
          </div>

          <div class="compact-card-footer">
            <strong style="color:#ffffff;">${item.stateType === 'listed' ? item.listedPrice : item.faceValue}</strong>
            <span class="compact-inspect-cue">Details ↗</span>
          </div>
        </article>
      `;
    }).join("");

    loopCards = Array.from(desktopCarouselTrack.querySelectorAll(".desktop-loop-card"));
    loopCards.forEach(card => {
      card.addEventListener("click", () => {
        if (wasLoopDragged) return;
        openDetailModal(card.dataset.key, card);
      });
    });
  }

  desktopCarouselViewport.addEventListener("mouseenter", () => { isLoopPaused = true; });
  desktopCarouselViewport.addEventListener("mouseleave", () => {
    if (!passDetailBackdrop.classList.contains("open")) isLoopPaused = false;
    isLoopDragging = false;
  });

  desktopCarouselViewport.addEventListener("pointerdown", (e) => {
    isLoopDragging = true;
    wasLoopDragged = false;
    loopDragStartX = e.clientX;
    loopDragStartScroll = loopScrollX;
  });

  window.addEventListener("pointermove", (e) => {
    if (!isLoopDragging) return;
    const dx = e.clientX - loopDragStartX;
    if (Math.abs(dx) > 5) wasLoopDragged = true;
    loopScrollX = loopDragStartScroll - dx;
  });

  window.addEventListener("pointerup", () => {
    isLoopDragging = false;
  });

  desktopCarouselViewport.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      loopScrollX += e.deltaX;
    }
  }, { passive: false });

  function updateDesktopLoopPositions() {
    if (!archiveStage.classList.contains("desktop-folder-open") || loopCards.length === 0) return;

    if (!isLoopPaused && !isLoopDragging) {
      loopScrollX += 0.55;
    }

    const vpWidth = desktopCarouselViewport.clientWidth || 1120;
    const centerOffset = Math.max(0, (vpWidth - loopCards.length * loopStride) / 2);

    loopCards.forEach((card, i) => {
      let x = i * loopStride - loopScrollX;
      x = ((x % loopTotalWidth) + loopTotalWidth) % loopTotalWidth;
      if (x > loopTotalWidth - loopStride) {
        x -= loopTotalWidth;
      }
      card.style.transform = `translate3d(${(x + centerOffset).toFixed(1)}px, 0, 0)`;
    });
  }

  // 手机端：从上往下铺满卡片栈（仅精简信息，点击打开详情弹窗）
  function renderMobileWalletStack(folderType, animateEntry = false) {
    const list = passesData.filter(p => p.folder === folderType);
    const n = list.length;

    const availableH = Math.max(460, window.innerHeight - 124);
    const cardH = Math.min(265, Math.max(205, Math.round(availableH * 0.43)));
    let step = n > 1 ? Math.floor((availableH - cardH) / (n - 1)) : 0;
    step = Math.min(cardH - 22, Math.max(82, step));
    const overlap = n > 1 ? -(cardH - step) : 0;

    walletCardsStack.style.setProperty("--wallet-card-h", `${cardH}px`);
    walletCardsStack.style.setProperty("--wallet-overlap", `${overlap}px`);

    walletCardsStack.innerHTML = list.map((item, index) => {
      const k = getItemKey(item);
      const displayPrice = item.stateType === "listed" ? item.listedPrice : item.faceValue;
      return `
        <article class="wallet-pass-card"
          data-theme="${item.theme}"
          data-key="${k}"
          style="${animateEntry ? `animation-delay: ${index * 0.045}s;` : 'animation: none;'}"
          onclick="openDetailModal('${k}', this)">
          <div class="folder-halftone"></div>
          <div>
            <div class="wcard-header">
              <div>
                <div class="wcard-brand">NFT #${item.tokenId} · ${item.statusText}</div>
                <h3 class="wcard-title">${item.title}</h3>
              </div>
              <span class="wcard-tier-pill">${item.tier}</span>
            </div>

            <div class="wcard-sub-meta">
              <span>📅 ${item.dateTime}</span>
            </div>
            <div class="wcard-sub-meta">
              <span>📍 ${item.venue}</span>
            </div>
          </div>

          <div class="wcard-compact-footer">
            <strong style="color:#ffffff;">${displayPrice}</strong>
            <span class="wcard-inspect-cue">Details ↗</span>
          </div>
        </article>
      `;
    }).join("");
  }

  window.addEventListener("resize", () => {
    if (walletOverlay.classList.contains("open") && currentFolderType) {
      renderMobileWalletStack(currentFolderType, false);
    }
  });

  function closeDesktopFan() {
    archiveStage.classList.remove("desktop-folder-open");
    folderUnused.classList.remove("is-active-folder");
    folderUsed.classList.remove("is-active-folder");
    unusedHintPill.textContent = "Open Passes →";
    usedHintPill.textContent = "Open Passes →";
    currentFolderType = null;
    loopCards = [];
  }

  function closeMobileOverlay() {
    clearTimeout(mobileCloseTimer);
    walletOverlay.classList.remove("open");
    mobileCloseTimer = setTimeout(() => {
      if (!walletOverlay.classList.contains("open")) {
        currentFolderType = null;
        walletCardsStack.innerHTML = "";
      }
    }, 300);
  }

  function openDesktopFolder(folderType) {
    currentFolderType = folderType;
    buildDesktopLoopCarousel(folderType, true);
    archiveStage.classList.add("desktop-folder-open");

    folderUnused.classList.toggle("is-active-folder", folderType === "unused");
    folderUsed.classList.toggle("is-active-folder", folderType === "used");

    unusedHintPill.textContent = "Switch to Used & History ⇄";
    usedHintPill.textContent = "Switch to Unused Passes ⇄";
  }

  function handleFolderClick(folderType) {
    const isDesktop = window.innerWidth >= 821;

    if (isDesktop) {
      if (archiveStage.classList.contains("desktop-folder-open")) {
        const nextFolder = currentFolderType === "unused" ? "used" : "unused";
        openDesktopFolder(nextFolder);
        return;
      }
      openDesktopFolder(folderType);
    } else {
      clearTimeout(mobileCloseTimer);
      currentFolderType = folderType;
      renderMobileWalletStack(folderType, true);
      requestAnimationFrame(() => {
        walletOverlay.classList.add("open");
      });
    }
  }

  unusedHintPill.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.innerWidth >= 821 && archiveStage.classList.contains("desktop-folder-open")) {
      openDesktopFolder("used");
    } else {
      handleFolderClick("unused");
    }
  });

  usedHintPill.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.innerWidth >= 821 && archiveStage.classList.contains("desktop-folder-open")) {
      openDesktopFolder("unused");
    } else {
      handleFolderClick("used");
    }
  });

  folderUnused.addEventListener("click", () => handleFolderClick("unused"));
  folderUsed.addEventListener("click", () => handleFolderClick("used"));
  desktopCollapseBtn.addEventListener("click", closeDesktopFan);
  closeWalletBtn.addEventListener("click", closeMobileOverlay);

  walletOverlay.addEventListener("click", (e) => {
    if (e.target === walletOverlay) closeMobileOverlay();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (passDetailBackdrop.classList.contains("open")) {
        closeDetailModal();
      } else if (!objectionModal.classList.contains("open")) {
        closeMobileOverlay();
        closeDesktopFan();
      }
    }
  });

  window.submitObjectionVote = function(key) {
    const target = passesData.find(p => getItemKey(p) === key);
    if (!target || target.voted) return;

    runTxProgressFlow({
      title: "Object to organizer payout",
      step1Label: "Confirm your objection in your wallet",
      step2Label: "Record your vote",
      step2DoneLabel: "Recorded",
      onComplete: () => {
        if (!target.voted) {
          target.voted = true;
          target.objections += 1;
          if (inspectedKey === key) renderDetailModal(target);
          if (currentFolderType && window.innerWidth < 821) {
            renderMobileWalletStack(currentFolderType, false);
          }
        }
      }
    });
  };

  /* ================= 6. 统一拓扑波浪与星尘背景动效 ================= */
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
    updateDesktopLoopPositions();

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
