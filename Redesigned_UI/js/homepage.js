  /* ================= 1. 背景拓扑波浪与星尘动效 ================= */
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

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
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
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
    ctx.globalCompositeOperation = 'lighter';

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

  /* ================= 2. 钱包弹窗与 Loading 切换逻辑 ================= */
  (() => {
    const connectBtn = document.getElementById("headerConnectBtn");
    const walletModal = document.getElementById("walletModal");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const okxWalletBtn = document.getElementById("okxWalletBtn");
    const walletSelectView = document.getElementById("walletSelectView");
    const walletLoadingView = document.getElementById("walletLoadingView");

    function showSelectView() {
      walletLoadingView.classList.add("hidden");
      walletSelectView.classList.remove("hidden");
      closeModalBtn.style.display = "grid";
    }

    function showLoadingView() {
      walletSelectView.classList.add("hidden");
      walletLoadingView.classList.remove("hidden");
      closeModalBtn.style.display = "none";
    }

    function openWalletModal() {
      showSelectView();
      walletModal.classList.add("open");
    }

    function closeWalletModal() {
      walletModal.classList.remove("open");
      setTimeout(showSelectView, 300);
    }

    window.WalletModal = {
      open: openWalletModal,
      close: closeWalletModal,
      showLoading: showLoadingView,
      reset: showSelectView
    };

    if (connectBtn) connectBtn.addEventListener("click", openWalletModal);
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeWalletModal);

    walletModal.addEventListener("click", (e) => {
      if (e.target === walletModal) closeWalletModal();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeWalletModal();
    });

    okxWalletBtn.addEventListener("click", async () => {
      showLoadingView();
      if (window.okxwallet) {
        try {
          await window.okxwallet.request({ method: "eth_requestAccounts" });
          closeWalletModal();
        } catch (err) {
          showSelectView();
        }
      }
    });
  })();
