/**
 * Rooted — Food Redistribution Intelligence
 * Client interactions, Plotly charts, live digital clock & 3D motion engine
 */

const chartTheme = {
  font: { family: 'DM Mono, monospace', size: 12, color: '#596057' },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  margin: { t: 18, r: 24, b: 52, l: 54 },
  colorway: ['#e26d3f', '#205d4f', '#e4b85d', '#71968c', '#b9c9a9'],
  xaxis: { gridcolor: '#e6e9e1', zeroline: false },
  yaxis: { gridcolor: '#e6e9e1', zeroline: false },
  hoverlabel: { bgcolor: '#17251e', font: { color: '#fff', family: 'DM Mono, monospace' } },
  transition: { duration: 600, easing: 'cubic-in-out' }
};

/* ==========================================================================
   Live Digital Clock (Updates in Seconds)
   ========================================================================== */

function initLiveClock() {
  const clockEl = document.getElementById('live-clock-time');
  const sidebarClock = document.getElementById('sidebar-clock-sec');

  function tick() {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[now.getDay()];
    const dateNum = String(now.getDate()).padStart(2, '0');
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const formattedClock = `${dayName}, ${dateNum} ${monthName} ${year} · ${hours}:${minutes}:${seconds}`;

    if (clockEl) {
      clockEl.textContent = formattedClock;
    }
    if (sidebarClock) {
      sidebarClock.textContent = `${hours}:${minutes}:${seconds}`;
    }
  }

  tick();
  setInterval(tick, 1000);
}

/* ==========================================================================
   Number Animation Helper
   ========================================================================== */

function animateValue(element, target, suffix = '', decimals = 0) {
  if (!element) return;

  const start = Number(element.dataset.value || 0);
  const duration = 650;
  const startTime = performance.now();

  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    const formatted = decimals ? current.toFixed(decimals) : Math.round(current);
    element.innerHTML = `${formatted.toLocaleString()}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.dataset.value = target;
    }
  };

  requestAnimationFrame(step);
}

/* ==========================================================================
   Plotly Charts Rendering
   ========================================================================== */

function plot(id, traces, layout = {}) {
  const node = document.getElementById(id);
  if (!node || typeof Plotly === 'undefined') return;
  node.classList.remove('chart-ready');
  Plotly.react(node, traces, { ...chartTheme, ...layout }, {
    responsive: true,
    displayModeBar: false,
    scrollZoom: false,
    doubleClick: 'reset',
  }).then(() => {
    node.classList.add('chart-ready');
    node.on('plotly_hover', () => node.closest('.chart-panel')?.classList.add('chart-focused'));
    node.on('plotly_unhover', () => node.closest('.chart-panel')?.classList.remove('chart-focused'));
  });
}

function renderCharts(data) {
  if (!data) return;
  const isMobile = window.innerWidth <= 640;

  // 1. Surplus by Food Category
  plot('category-chart', [{
    x: data.category.map(d => d.category),
    y: data.category.map(d => d.quantity_kg),
    type: 'bar',
    marker: { color: '#e26d3f', cornerradius: 4 },
    hovertemplate: '%{x}<br>%{y:,.0f} kg<extra></extra>'
  }], {
    xaxis: { ...chartTheme.xaxis, tickangle: -20 },
    yaxis: { ...chartTheme.yaxis, title: 'kg', separatethousands: true }
  });

  // 2. Claims by Status Outcome
  const statusColors = { Pending: '#e4b85d', Completed: '#205d4f', Collected: '#71968c', Cancelled: '#e26d3f' };
  plot('status-chart', [{
    labels: data.status.map(d => d.status),
    values: data.status.map(d => d.claimed_kg),
    type: 'pie',
    hole: 0.62,
    marker: { colors: data.status.map(d => statusColors[d.status] || '#a3b8a3') },
    textinfo: 'label+percent',
    textposition: 'outside',
    hovertemplate: '%{label}<br>%{value:,.0f} kg<extra></extra>'
  }], {
    showlegend: false,
    margin: { t: 15, r: 15, b: 15, l: 15 }
  });

  // 3. Top Provider Contribution (Segmented by Food Type)
  const providerMarginLeft = isMobile ? 120 : 180;
  const foodCategoryColors = {
    'Prepared Meals': '#205d4f', // Deep Pine / Forest Green
    'Bakery': '#e26d3f',         // Warm Amber / Terracotta
    'Fresh Produce': '#10b981',  // Fresh Leaf Green
    'Dairy': '#0284c7',          // Clear Sky Blue
    'Staples': '#e4b85d',        // Harvest Gold / Wheat
    'Other': '#71968c',          // Muted Sage
    'Beverages': '#6366f1',      // Royal Indigo
    'Meat & Poultry': '#be123c'  // Crimson
  };
  const fallbackColors = ['#205d4f', '#e26d3f', '#e4b85d', '#10b981', '#0284c7', '#71968c', '#8b5cf6', '#be123c'];

  if (data.provider && data.provider.traces && Array.isArray(data.provider.traces)) {
    const providerNames = data.provider.providers || [];
    const traces = data.provider.traces.map((trace, idx) => {
      const color = foodCategoryColors[trace.category] || fallbackColors[idx % fallbackColors.length];
      return {
        name: trace.category,
        x: trace.values,
        y: providerNames,
        type: 'bar',
        orientation: 'h',
        marker: { color: color, cornerradius: 3 },
        customdata: trace.items,
        text: trace.values.map((v, i) => {
          if (!v || v < 60) return '';
          const sampleItem = (trace.items[i] || '').split(',')[0].trim();
          if (v >= 320 && sampleItem) {
            return `${trace.category} · ${sampleItem} (${Math.round(v)}kg)`;
          }
          if (v >= 170) {
            return `${trace.category} (${Math.round(v)}kg)`;
          }
          if (v >= 75) {
            return trace.category;
          }
          return '';
        }),
        textposition: 'inside',
        insidetextanchor: 'middle',
        insidetextfont: {
          family: 'Space Grotesk, system-ui, sans-serif',
          size: isMobile ? 9 : 11,
          color: '#ffffff'
        },
        constraintext: 'inside',
        hovertemplate: '<b>%{y}</b><br>Food Type: <b>' + trace.category + '</b><br>Quantity: <b>%{x:,.1f} kg</b><br>Sample items: <i>%{customdata}</i><extra></extra>'
      };
    });

    plot('provider-chart', traces, {
      barmode: 'stack',
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.15,
        xanchor: 'left',
        yanchor: 'bottom',
        font: { family: 'DM Mono, monospace', size: isMobile ? 10 : 11, color: '#596057' },
        itemclick: 'toggle',
        itemdoubleclick: 'toggleothers'
      },
      xaxis: { ...chartTheme.xaxis, title: 'kg listed', separatethousands: true },
      yaxis: {
        ...chartTheme.yaxis,
        autorange: 'reversed',
        automargin: true,
        tickfont: { size: isMobile ? 10 : 11, family: 'Space Grotesk, sans-serif', color: '#17251e' }
      },
      margin: { ...chartTheme.margin, l: providerMarginLeft, r: 24, t: 40, b: 50 }
    });
  } else if (Array.isArray(data.provider)) {
    plot('provider-chart', [{
      x: data.provider.map(d => d.quantity_kg),
      y: data.provider.map(d => d.provider),
      type: 'bar',
      orientation: 'h',
      marker: { color: '#205d4f', cornerradius: 4 },
      hovertemplate: '%{y}<br>%{x:,.0f} kg<extra></extra>'
    }], {
      xaxis: { ...chartTheme.xaxis, title: 'kg listed', separatethousands: true },
      yaxis: { ...chartTheme.yaxis, autorange: 'reversed', automargin: true, tickfont: { size: isMobile ? 10 : 11 } },
      margin: { ...chartTheme.margin, l: providerMarginLeft, r: 24 }
    });
  }

  // 4. Claim Activity Over Time
  plot('timeline-chart', [{
    x: data.timeline.map(d => d.day),
    y: data.timeline.map(d => d.claimed_kg),
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#e26d3f', width: 3, shape: 'spline' },
    marker: { color: '#e26d3f', size: 7 },
    fill: 'tozeroy',
    fillcolor: 'rgba(226,109,63,.10)',
    hovertemplate: '%{x}<br>%{y:,.0f} kg claimed<extra></extra>'
  }], {
    xaxis: { ...chartTheme.xaxis, title: 'Claim Date', tickangle: -35, nticks: 10, automargin: true },
    yaxis: { ...chartTheme.yaxis, title: 'kg', separatethousands: true }
  });
}

function updateMetrics(insights) {
  if (!insights) return;
  const listElement = document.getElementById('metric-listed');
  const completedElement = document.getElementById('metric-completed');
  const noteElement = document.querySelector('.note-number');

  animateValue(listElement, insights.total_listed, '<small> kg</small>', 1);
  animateValue(completedElement, insights.completed_kg, '<small> kg</small>', 1);

  const activeEl = document.getElementById('metric-active');
  const providersEl = document.getElementById('metric-providers');
  const receiversEl = document.getElementById('metric-receivers');

  if (activeEl) activeEl.textContent = insights.active_listings;
  if (providersEl) providersEl.textContent = insights.providers;
  if (receiversEl) receiversEl.textContent = insights.receivers;
  if (noteElement) noteElement.textContent = `${insights.diversion_rate}%`;
}

/* ==========================================================================
   3D Spatial Physics & Motion Engine
   ========================================================================== */

function addMotionEffects() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsHover = window.matchMedia('(hover: hover)').matches;

  // 1. 3D Tilt Cards with Specular Highlight and Parallax Depth
  const tiltItems = document.querySelectorAll('.metric-card, .chart-panel, .form-panel, .form-aside, .login-card, .hero-note, .schema-card');

  if (!reducedMotion && supportsHover) {
    tiltItems.forEach((element) => {
      element.classList.add('tilt-card');
      let frame;
      const reset = () => {
        cancelAnimationFrame(frame);
        element.style.setProperty('--tilt-x', '0deg');
        element.style.setProperty('--tilt-y', '0deg');
        element.style.setProperty('--pointer-x', '50%');
        element.style.setProperty('--pointer-y', '50%');
        element.classList.remove('is-tilting');
      };

      element.addEventListener('pointermove', (event) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          // Smooth 3D perspective rotation
          element.style.setProperty('--tilt-x', `${(0.5 - y) * 8}deg`);
          element.style.setProperty('--tilt-y', `${(x - 0.5) * 8}deg`);
          element.style.setProperty('--pointer-x', `${x * 100}%`);
          element.style.setProperty('--pointer-y', `${y * 100}%`);
          element.classList.add('is-tilting');
        });
      });
      element.addEventListener('pointerleave', reset);
      element.addEventListener('blur', reset, true);
    });

    // 2. 3D Magnetic Tilt on Buttons & Controls
    document.querySelectorAll('.button, .demo-chip, .user-chip, .filter.selected').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.12;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
        button.style.setProperty('--magnetic-x', `${x}px`);
        button.style.setProperty('--magnetic-y', `${y}px`);
      });

      button.addEventListener('pointerleave', () => {
        button.style.setProperty('--magnetic-x', '0px');
        button.style.setProperty('--magnetic-y', '0px');
      });
    });
  }

  // 3. Ripple effect on button clicks
  document.querySelectorAll('.button, .demo-chip').forEach((button) => {
    button.addEventListener('click', (event) => {
      if (reducedMotion) return;
      const ripple = document.createElement('span');
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top + rect.height / 2;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x - rect.left - size / 2}px`;
      ripple.style.top = `${y - rect.top - size / 2}px`;
      ripple.className = 'ripple';
      button.appendChild(ripple);
      setTimeout(() => ripple.remove(), 550);
    });
  });

  // 4. Form state handling
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      const method = (form.getAttribute('method') || 'GET').toUpperCase();
      if (method === 'GET') return;
      const submit = form.querySelector('button[type="submit"]');
      if (!submit || submit.disabled) return;
      submit.disabled = true;
      submit.dataset.originalText = submit.textContent;
      submit.textContent = 'Saving...';
    });
  });

  // 5. Active form input highlighting
  document.querySelectorAll('input, select, textarea').forEach((field) => {
    field.addEventListener('focus', () => field.closest('label')?.classList.add('field-active'));
    field.addEventListener('blur', () => field.closest('label')?.classList.remove('field-active'));
  });

  // 6. Responsive Plotly chart redraw
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      document.querySelectorAll('.chart').forEach((node) => {
        if (typeof Plotly !== 'undefined' && node.data) {
          Plotly.Plots.resize(node);
        }
      });
    }, 150);
  });
}

/* ==========================================================================
   Dashboard Date Filter Handler
   ========================================================================== */

const initialData = window.dashboardData;
if (initialData) {
  renderCharts(initialData);
  const filterForm = document.getElementById('date-filter-form');
  const applyButton = document.getElementById('apply-date-filter');
  const startInput = document.getElementById('date-start');
  const endInput = document.getElementById('date-end');
  const status = document.getElementById('filter-status');

  async function applyDateFilter(event) {
    if (!startInput || !endInput) return;
    if (!startInput.value || !endInput.value || startInput.value > endInput.value) {
      if (status) {
        status.textContent = 'Choose a valid start and end date.';
        status.classList.add('filter-error');
      }
      if (event) event.preventDefault();
      return;
    }

    if (applyButton) {
      applyButton.disabled = true;
      applyButton.classList.add('is-processing');
      applyButton.textContent = 'Updating...';
    }
    if (status) status.classList.remove('filter-error');

    try {
      const url = `/api/summary?start=${encodeURIComponent(startInput.value)}&end=${encodeURIComponent(endInput.value)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Unable to update view');
      const payload = await response.json();

      updateMetrics(payload.insights);
      renderCharts(payload.charts);
      if (status) status.textContent = `Showing ${payload.start} to ${payload.end}`;
      document.querySelector('.dashboard-content')?.classList.add('data-refresh');

      // Update URL query params smoothly so current view is shareable / refreshable
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('start', payload.start);
      newUrl.searchParams.set('end', payload.end);
      window.history.pushState(null, '', newUrl.toString());
    } catch (error) {
      if (status) {
        status.textContent = 'Could not update the selected period.';
        status.classList.add('filter-error');
      }
    } finally {
      if (applyButton) {
        applyButton.disabled = false;
        applyButton.classList.remove('is-processing');
        applyButton.textContent = 'Update view';
      }
    }

    if (event) event.preventDefault();
  }

  filterForm?.addEventListener('submit', applyDateFilter);
  startInput?.addEventListener('change', () => applyDateFilter(null));
  endInput?.addEventListener('change', () => applyDateFilter(null));
}

/* ==========================================================================
   Interactive 3D Spatial Logistics Twin Engine (Three.js WebGL)
   ========================================================================== */

function initInteractive3DModel() {
  const container = document.getElementById('model-3d-canvas-container');
  if (!container || typeof THREE === 'undefined') return;

  try {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 440;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf7f8f3, 0.025);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4, 18);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.2);
    dirLight.position.set(12, 18, 14);
    scene.add(dirLight);

    const coreLight = new THREE.PointLight(0x10b981, 2.8, 30);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const tapmiLight = new THREE.PointLight(0xe26d3f, 2.2, 20);
    tapmiLight.position.set(4, 2, 4);
    scene.add(tapmiLight);

    // 4. Model Groups
    const networkRoot = new THREE.Group();
    scene.add(networkRoot);

    const orbitGroup = new THREE.Group();
    const crateGroup = new THREE.Group();
    crateGroup.visible = false;
    networkRoot.add(orbitGroup);
    networkRoot.add(crateGroup);

    // --- MODE 1: ORBITAL REDISTRIBUTION NETWORK ---
    // A. Central Core Polyhedron
    const coreGeo = new THREE.IcosahedronGeometry(2.0, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x16483d,
      roughness: 0.25,
      metalness: 0.8,
      transparent: true,
      opacity: 0.82,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    orbitGroup.add(coreMesh);

    const wireGeo = new THREE.WireframeGeometry(coreGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 1.5 });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    orbitGroup.add(wireMesh);

    // Inner glowing sphere
    const innerGeo = new THREE.SphereGeometry(1.05, 24, 24);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xe26d3f });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    orbitGroup.add(innerCore);

    // B. Orbital Rings
    function makeRing(radius, tube, color, rotX, rotY, rotZ) {
      const ringGeo = new THREE.TorusGeometry(radius, tube, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.set(rotX, rotY, rotZ);
      return ring;
    }

    const ring1 = makeRing(5.2, 0.04, 0x205d4f, Math.PI / 3, 0.2, 0);
    const ring2 = makeRing(7.6, 0.04, 0xe26d3f, 0.4, Math.PI / 4, 0.3);
    const ring3 = makeRing(10.2, 0.035, 0xe4b85d, -0.6, 0.3, Math.PI / 3);
    orbitGroup.add(ring1);
    orbitGroup.add(ring2);
    orbitGroup.add(ring3);

    // C. Satellite Nodes (Providers & Receivers)
    const nodes = [
      { name: 'TAPMI Campus Dining', type: 'provider', r: 5.2, angle: 0, speed: 0.012, color: 0xe26d3f, size: 0.45, isTapmi: true },
      { name: 'Manipal Food Court 1', type: 'provider', r: 5.2, angle: Math.PI * 0.7, speed: 0.012, color: 0x10b981, size: 0.35 },
      { name: 'Campus Cafeteria 2', type: 'provider', r: 5.2, angle: Math.PI * 1.4, speed: 0.012, color: 0x10b981, size: 0.35 },
      { name: 'Akshaya Patra Foundation', type: 'receiver', r: 7.6, angle: 0.5, speed: -0.009, color: 0x38bdf8, size: 0.38 },
      { name: 'Child Haven Shelter', type: 'receiver', r: 7.6, angle: 2.6, speed: -0.009, color: 0x38bdf8, size: 0.36 },
      { name: 'Udupi Seva Sangha', type: 'receiver', r: 10.2, angle: 1.8, speed: 0.007, color: 0xe4b85d, size: 0.34 },
      { name: 'Community Care Kitchen', type: 'receiver', r: 10.2, angle: 4.5, speed: 0.007, color: 0xe4b85d, size: 0.34 },
    ];

    const nodeMeshes = [];
    nodes.forEach((n) => {
      const g = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(n.size, 16, 16),
        new THREE.MeshStandardMaterial({
          color: n.color,
          emissive: n.color,
          emissiveIntensity: n.isTapmi ? 0.7 : 0.4,
          roughness: 0.2,
        })
      );
      g.add(sphere);

      if (n.isTapmi) {
        // Glowing halo ring around TAPMI hub
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.65, 0.78, 32),
          new THREE.MeshBasicMaterial({ color: 0xe26d3f, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        halo.rotation.x = Math.PI / 2;
        g.add(halo);
      }

      orbitGroup.add(g);
      nodeMeshes.push({ group: g, def: n, currentAngle: n.angle });
    });

    // D. Flow Arcs & Dynamic Redistribution Particles
    const arcCount = 4;
    const arcParticles = [];
    const packetGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const packetMatPulse = new THREE.MeshBasicMaterial({ color: 0xe26d3f });

    for (let i = 0; i < 20; i++) {
      const p = new THREE.Mesh(packetGeo, i % 2 === 0 ? packetMat : packetMatPulse);
      p.userData = {
        curveIdx: i % arcCount,
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.006,
      };
      orbitGroup.add(p);
      arcParticles.push(p);
    }

    // Dynamic Spline Lines
    const arcLines = [];
    for (let i = 0; i < arcCount; i++) {
      const lineGeo = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.45,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      orbitGroup.add(line);
      arcLines.push(line);
    }

    // --- MODE 2: LOGISTICS SMART CRATE MODEL ---
    const crateBoxGeo = new THREE.BoxGeometry(3.6, 3.6, 3.6);
    const crateBoxMat = new THREE.MeshStandardMaterial({
      color: 0x14483d,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
      metalness: 0.6,
    });
    const crateMesh = new THREE.Mesh(crateBoxGeo, crateBoxMat);
    crateGroup.add(crateMesh);

    const crateWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(crateBoxGeo),
      new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
    );
    crateGroup.add(crateWire);

    // Inner scanning plane
    const scanPlaneGeo = new THREE.PlaneGeometry(3.4, 3.4);
    const scanPlaneMat = new THREE.MeshBasicMaterial({
      color: 0xe26d3f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const scanPlane = new THREE.Mesh(scanPlaneGeo, scanPlaneMat);
    crateGroup.add(scanPlane);

    // Floating Sensor Rings
    const crateRing = makeRing(3.2, 0.04, 0xe4b85d, Math.PI / 2, 0, 0);
    crateGroup.add(crateRing);

    // 5. Interaction Controls (Mouse & Touch Rotation, Zoom, Damping)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotVelX = 0;
    let rotVelY = 0.003; // natural subtle spin
    let targetZoom = 18;
    let currentZoom = 18;
    let isPulseActive = false;
    let pulseTimer = 0;

    container.addEventListener('pointerdown', (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      rotVelX = 0;
      rotVelY = 0;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      networkRoot.rotation.y += dx * 0.007;
      networkRoot.rotation.x += dy * 0.007;
      rotVelY = dx * 0.007;
      rotVelX = dy * 0.007;
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
    });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      targetZoom += e.deltaY * 0.015;
      targetZoom = Math.max(9, Math.min(26, targetZoom));
    }, { passive: false });

    // Mode Buttons
    const btnOrbit = document.getElementById('btn-mode-orbit');
    const btnCore = document.getElementById('btn-mode-core');
    const btnPulse = document.getElementById('btn-3d-pulse');
    const btnReset = document.getElementById('btn-3d-reset');

    function setMode(mode) {
      if (mode === 'orbit') {
        orbitGroup.visible = true;
        crateGroup.visible = false;
        btnOrbit?.classList.add('active');
        btnCore?.classList.remove('active');
      } else {
        orbitGroup.visible = false;
        crateGroup.visible = true;
        btnOrbit?.classList.remove('active');
        btnCore?.classList.add('active');
      }
    }

    btnOrbit?.addEventListener('click', () => setMode('orbit'));
    btnCore?.addEventListener('click', () => setMode('core'));

    btnPulse?.addEventListener('click', () => {
      isPulseActive = true;
      pulseTimer = 180;
      coreLight.intensity = 6.0;
      btnPulse.classList.add('button-dark');
      btnPulse.classList.remove('button-light');
      setTimeout(() => {
        btnPulse.classList.remove('button-dark');
        btnPulse.classList.add('button-light');
      }, 1200);
    });

    btnReset?.addEventListener('click', () => {
      networkRoot.rotation.set(0, 0, 0);
      rotVelX = 0;
      rotVelY = 0.003;
      targetZoom = 18;
      setMode('orbit');
    });

    // 6. Animation Loop
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Camera zoom easing
      currentZoom += (targetZoom - currentZoom) * 0.08;
      camera.position.z = currentZoom;

      // Rotational inertia and damping
      if (!isDragging) {
        networkRoot.rotation.y += rotVelY;
        networkRoot.rotation.x += rotVelX;
        rotVelY *= 0.96;
        rotVelX *= 0.96;
        if (Math.abs(rotVelY) < 0.002) rotVelY = 0.0025; // maintain slow spin
      }

      // Orbital mode updates
      if (orbitGroup.visible) {
        coreMesh.rotation.x += 0.008;
        coreMesh.rotation.y += 0.012;
        wireMesh.rotation.x += 0.008;
        wireMesh.rotation.y += 0.012;

        const pulseScale = 1.0 + Math.sin(elapsed * 4) * 0.08;
        innerCore.scale.set(pulseScale, pulseScale, pulseScale);

        ring1.rotation.z += 0.004;
        ring2.rotation.y += 0.003;
        ring3.rotation.z -= 0.002;

        // Position nodes along orbits
        const tapmiPos = new THREE.Vector3();
        const receiverPositions = [];

        nodeMeshes.forEach((nm, idx) => {
          nm.currentAngle += nm.def.speed * (isPulseActive ? 2.5 : 1);
          const x = Math.cos(nm.currentAngle) * nm.def.r;
          const z = Math.sin(nm.currentAngle) * nm.def.r;
          const y = Math.sin(nm.currentAngle * 2 + idx) * 0.8;
          nm.group.position.set(x, y, z);

          if (nm.def.isTapmi) {
            tapmiPos.set(x, y, z);
          } else if (nm.def.type === 'receiver') {
            receiverPositions.push(new THREE.Vector3(x, y, z));
          }
        });

        // Update transfer spline curves
        const curves = [];
        receiverPositions.slice(0, arcCount).forEach((recPos, i) => {
          const mid = new THREE.Vector3()
            .addVectors(tapmiPos, recPos)
            .multiplyScalar(0.5);
          mid.y += 2.2 + i * 0.4;
          const curve = new THREE.QuadraticBezierCurve3(tapmiPos, mid, recPos);
          curves.push(curve);

          const pts = curve.getPoints(32);
          arcLines[i].geometry.setFromPoints(pts);
        });

        // Animate transfer packets
        if (curves.length > 0) {
          const speedMultiplier = isPulseActive ? 3.2 : 1.0;
          arcParticles.forEach((p) => {
            p.userData.progress += p.userData.speed * speedMultiplier;
            if (p.userData.progress > 1) p.userData.progress = 0;
            const activeCurve = curves[p.userData.curveIdx % curves.length];
            const pt = activeCurve.getPoint(p.userData.progress);
            p.position.copy(pt);
          });
        }

        // Pulse timer countdown
        if (isPulseActive) {
          pulseTimer--;
          if (pulseTimer <= 0) {
            isPulseActive = false;
            coreLight.intensity = 2.8;
          }
        }
      }

      // Logistics Crate mode updates
      if (crateGroup.visible) {
        crateMesh.rotation.y += 0.007;
        crateMesh.rotation.x = Math.sin(elapsed * 0.8) * 0.15;
        crateWire.rotation.copy(crateMesh.rotation);
        scanPlane.rotation.copy(crateMesh.rotation);
        scanPlane.position.y = Math.sin(elapsed * 2.5) * 1.5;
        crateRing.rotation.y -= 0.012;
      }

      renderer.render(scene, camera);
    }

    animate();

    // 7. Responsive Resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width;
        const newH = entry.contentRect.height;
        if (newW && newH) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

  } catch (err) {
    console.warn('Interactive 3D model initialization skipped:', err);
  }
}

/* ==========================================================================
   Ambient 3D Particle & Wireframe Background (Three.js WebGL)
   ========================================================================== */

function initAmbient3DBackground() {
  const canvas = document.getElementById('bg-3d-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    // Particle Constellation
    const particleCount = 140;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const green = new THREE.Color(0x205d4f);
    const orange = new THREE.Color(0xe26d3f);
    const yellow = new THREE.Color(0xe4b85d);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      const pick = Math.random();
      const col = pick > 0.6 ? green : pick > 0.3 ? orange : yellow;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Floating Polyhedral Wireframes
    const polyGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(7, 0));
    const polyMat = new THREE.LineBasicMaterial({ color: 0x205d4f, transparent: true, opacity: 0.12 });
    const polyMesh = new THREE.LineSegments(polyGeo, polyMat);
    polyMesh.position.set(28, 12, -15);
    scene.add(polyMesh);

    const polyGeo2 = new THREE.WireframeGeometry(new THREE.OctahedronGeometry(5, 0));
    const polyMat2 = new THREE.LineBasicMaterial({ color: 0xe26d3f, transparent: true, opacity: 0.10 });
    const polyMesh2 = new THREE.LineSegments(polyGeo2, polyMat2);
    polyMesh2.position.set(-32, -16, -10);
    scene.add(polyMesh2);

    // Parallax Cursor Tilt
    let mouseX = 0;
    let mouseY = 0;
    window.addEventListener('pointermove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 14;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 14;
    });

    function animateBg() {
      requestAnimationFrame(animateBg);
      particles.rotation.y += 0.0006;
      particles.rotation.x += 0.0003;
      polyMesh.rotation.y += 0.003;
      polyMesh.rotation.x += 0.002;
      polyMesh2.rotation.y -= 0.0025;
      polyMesh2.rotation.z += 0.002;

      camera.position.x += (mouseX - camera.position.x) * 0.04;
      camera.position.y += (-mouseY - camera.position.y) * 0.04;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    }

    animateBg();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  } catch (err) {
    console.warn('Ambient 3D background initialization skipped:', err);
  }
}

// Start motion effects, 3D engines & live clock on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  addMotionEffects();
  initInteractive3DModel();
  initAmbient3DBackground();
});

