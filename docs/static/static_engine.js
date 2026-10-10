/**
 * Rooted — Client-Side Relational & Analytics Engine for GitHub Pages
 * Emulates Flask routes, RBAC sessions, Pandas aggregations, and SQL transactions in browser.
 */
(function () {
  if (!window.ROOTED_DB) return;

  const STORAGE_KEYS = {
    USER: 'rooted_active_user_v1',
    CUSTOM_LISTINGS: 'rooted_custom_listings_v1',
    CUSTOM_CLAIMS: 'rooted_custom_claims_v1',
    CLAIM_UPDATES: 'rooted_claim_updates_v1',
    FLASH: 'rooted_flash_msg_v1'
  };

  const DEFAULT_ADMIN = {
    user_id: 122,
    username: 'admin@rooted.local',
    role: 'admin',
    display_name: 'System Administrator',
    provider_id: null,
    receiver_id: null
  };

  function getActiveUser() {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('demo_role');
    if (roleParam) {
      let targetUser = null;
      if (roleParam === 'admin') targetUser = window.ROOTED_DB.users.find(u => u.username === 'admin@rooted.local');
      else if (roleParam === 'tapmi') targetUser = window.ROOTED_DB.users.find(u => u.username === 'tapmi@rooted.local');
      else if (roleParam === 'provider') targetUser = window.ROOTED_DB.users.find(u => u.username === 'provider1@rooted.local');
      else if (roleParam === 'ngo') targetUser = window.ROOTED_DB.users.find(u => u.username === 'ngo@rooted.local');
      if (targetUser) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(targetUser));
      }
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_ADMIN;
  }

  function setActiveUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  function setFlash(category, message) {
    sessionStorage.setItem(STORAGE_KEYS.FLASH, JSON.stringify({ category, message }));
  }

  function showPendingFlash() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.FLASH);
      if (!raw) return;
      sessionStorage.removeItem(STORAGE_KEYS.FLASH);
      const { category, message } = JSON.parse(raw);
      const main = document.querySelector('.main-content');
      if (!main) return;
      let stack = main.querySelector('.flash-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.className = 'flash-stack';
        const topbar = main.querySelector('.topbar');
        if (topbar && topbar.nextSibling) {
          main.insertBefore(stack, topbar.nextSibling);
        } else {
          main.prepend(stack);
        }
      }
      stack.innerHTML = `<div class="flash ${category}">${message}</div>`;
    } catch (e) {}
  }

  function getMergedData() {
    const baseListings = window.ROOTED_DB.listings.map(l => ({ ...l }));
    const baseClaims = window.ROOTED_DB.claims.map(c => ({ ...c }));

    try {
      const customListings = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_LISTINGS) || '[]');
      baseListings.unshift(...customListings);
    } catch (e) {}

    try {
      const customClaims = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_CLAIMS) || '[]');
      baseClaims.unshift(...customClaims);
    } catch (e) {}

    try {
      const updates = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLAIM_UPDATES) || '{}');
      baseClaims.forEach(c => {
        if (updates[c.claim_id]) {
          c.status = updates[c.claim_id].status;
          if (updates[c.claim_id].pickup_at) c.pickup_at = updates[c.claim_id].pickup_at;
        }
      });
    } catch (e) {}

    // Recompute remaining_kg and status from active claims
    const activeByListing = {};
    baseClaims.forEach(c => {
      if (['Pending', 'Completed', 'Collected'].includes(c.status)) {
        activeByListing[c.listing_id] = (activeByListing[c.listing_id] || 0) + Number(c.claimed_kg);
      }
    });

    baseListings.forEach(l => {
      const claimed = activeByListing[l.listing_id] || 0;
      l.remaining_kg = Math.max(0, Math.round((Number(l.quantity_kg) - claimed) * 10) / 10);
      if (claimed > 0 && l.status === 'Available') {
        l.status = 'Claimed';
      }
    });

    return { listings: baseListings, claims: baseClaims };
  }

  function computeSummary(start, end, providerId) {
    const { listings: allListings, claims: allClaims } = getMergedData();

    const filterByDate = (listingsArr, claimsArr) => {
      let l = listingsArr;
      let c = claimsArr;
      if (start) {
        l = l.filter(item => item.listed_at.slice(0, 10) >= start);
        c = c.filter(item => item.claimed_at.slice(0, 10) >= start);
      }
      if (end) {
        l = l.filter(item => item.listed_at.slice(0, 10) <= end);
        c = c.filter(item => item.claimed_at.slice(0, 10) <= end);
      }
      return { l, c };
    };

    let pListings = providerId ? allListings.filter(x => x.provider_id === providerId) : allListings;
    const pListingIds = new Set(pListings.map(x => x.listing_id));
    let pClaims = providerId ? allClaims.filter(x => pListingIds.has(x.listing_id)) : allClaims;

    const { l: filteredListings, c: filteredClaims } = filterByDate(pListings, pClaims);

    const totalListed = filteredListings.reduce((acc, x) => acc + Number(x.quantity_kg), 0);
    const totalClaimed = filteredClaims.reduce((acc, x) => acc + Number(x.claimed_kg), 0);
    const completedClaims = filteredClaims.filter(x => x.status === 'Completed' || x.status === 'Collected');
    const completedKg = completedClaims.reduce((acc, x) => acc + Number(x.claimed_kg), 0);
    const diversionRate = totalListed > 0 ? Math.round((completedKg / totalListed) * 1000) / 10 : 0;

    const activeCount = filteredListings.filter(x => x.status === 'Available' || x.status === 'Claimed').length;
    const uniqueProviders = new Set(filteredListings.map(x => x.provider)).size;
    const uniqueReceivers = new Set(filteredClaims.map(x => x.receiver)).size;

    const insights = {
      total_listed: Math.round(totalListed * 10) / 10,
      total_claimed: Math.round(totalClaimed * 10) / 10,
      completed_kg: Math.round(completedKg * 10) / 10,
      diversion_rate: diversionRate,
      active_listings: activeCount,
      providers: uniqueProviders,
      receivers: uniqueReceivers
    };

    // 1. Category breakdown
    const catMap = {};
    filteredListings.forEach(x => {
      catMap[x.category] = (catMap[x.category] || 0) + Number(x.quantity_kg);
    });
    const category = Object.entries(catMap)
      .map(([cat, kg]) => ({ category: cat, quantity_kg: Math.round(kg * 10) / 10 }))
      .sort((a, b) => b.quantity_kg - a.quantity_kg);

    // 2. Top Provider benchmark
    const { l: benchListings } = providerId ? filterByDate(allListings, allClaims) : { l: filteredListings };
    const currentProviderName = providerId && window.ROOTED_DB.providers[providerId]
      ? window.ROOTED_DB.providers[providerId].name
      : null;

    const provTotalsMap = {};
    benchListings.forEach(x => {
      provTotalsMap[x.provider] = (provTotalsMap[x.provider] || 0) + Number(x.quantity_kg);
    });
    let topProvArr = Object.entries(provTotalsMap)
      .map(([provider, quantity_kg]) => ({ provider, quantity_kg: Math.round(quantity_kg * 10) / 10 }))
      .sort((a, b) => b.quantity_kg - a.quantity_kg)
      .slice(0, 10);

    if (currentProviderName && !topProvArr.some(p => p.provider === currentProviderName)) {
      const ownTotal = Math.round((provTotalsMap[currentProviderName] || 0) * 10) / 10;
      if (ownTotal > 0) {
        topProvArr = [...topProvArr.slice(0, 9), { provider: currentProviderName, quantity_kg: ownTotal }];
      }
    }

    const topNames = topProvArr.map(p => p.provider);
    const topListings = benchListings.filter(x => topNames.includes(x.provider));

    const topCatsMap = {};
    topListings.forEach(x => {
      topCatsMap[x.category] = (topCatsMap[x.category] || 0) + Number(x.quantity_kg);
    });
    const orderedCats = Object.entries(topCatsMap)
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    const traces = orderedCats.map(cat => {
      const values = [];
      const items = [];
      topNames.forEach(pName => {
        const matches = topListings.filter(x => x.provider === pName && x.category === cat);
        if (matches.length > 0) {
          const sumKg = matches.reduce((s, m) => s + Number(m.quantity_kg), 0);
          const distinctItems = Array.from(new Set(matches.map(m => m.food_item).filter(Boolean))).sort().slice(0, 3).join(', ');
          values.push(Math.round(sumKg * 10) / 10);
          items.push(distinctItems);
        } else {
          values.push(0.0);
          items.push('');
        }
      });
      return { category: cat, values, items };
    });

    const displayNames = topNames.map(p => (currentProviderName && p === currentProviderName) ? `${p} (Your Facility)` : p);

    // 3. Status breakdown
    const statusOrder = ['Pending', 'Completed', 'Collected', 'Cancelled'];
    const statusMap = {};
    filteredClaims.forEach(x => {
      statusMap[x.status] = (statusMap[x.status] || 0) + Number(x.claimed_kg);
    });
    const status = statusOrder
      .filter(s => statusMap[s] !== undefined)
      .map(s => ({ status: s, claimed_kg: Math.round(statusMap[s] * 10) / 10 }));

    // 4. Timeline
    const dayMap = {};
    filteredClaims.forEach(x => {
      const d = x.claimed_at.slice(0, 10);
      dayMap[d] = (dayMap[d] || 0) + Number(x.claimed_kg);
    });
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const timeline = Object.keys(dayMap).sort().map(d => {
      const parts = d.split('-');
      const mIdx = parseInt(parts[1], 10) - 1;
      const label = `${months[mIdx]} ${parts[2]}`;
      return { day: label, claimed_kg: Math.round(dayMap[d] * 10) / 10 };
    });

    const recent = filteredListings.slice(0, 6);

    return {
      insights,
      charts: {
        category,
        provider: {
          providers: displayNames,
          totals: topProvArr.map(p => p.quantity_kg),
          traces,
          items: topProvArr
        },
        status,
        timeline
      },
      recent,
      start: start || window.ROOTED_DB.date_range.start,
      end: end || window.ROOTED_DB.date_range.end
    };
  }

  // Intercept fetch('/api/summary...') so static/app.js date filter works natively
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (urlStr.includes('/api/summary')) {
      const parsed = new URL(urlStr, window.location.origin);
      const start = parsed.searchParams.get('start');
      const end = parsed.searchParams.get('end');
      const user = getActiveUser();
      const providerId = user.role === 'provider' ? user.provider_id : null;
      const payload = computeSummary(start, end, providerId);
      renderRecentTable(payload.recent);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return origFetch.apply(this, arguments);
  };

  function renderRecentTable(recentRows) {
    const tbody = document.querySelector('.dashboard-content .table-panel tbody');
    if (!tbody) return;
    if (!recentRows || recentRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No listings in the selected period.</td></tr>';
      return;
    }
    tbody.innerHTML = recentRows.map(item => {
      const dietClass = (item.dietary_type || '').toLowerCase().replace(/-/g, '');
      const statusClass = (item.status || '').toLowerCase().replace(/\s+/g, '-');
      const idStr = String(item.listing_id).padStart(4, '0');
      return `<tr>
        <td><strong>${item.food_name}</strong><span class="subline">#${idStr}</span></td>
        <td><span class="diet diet-${dietClass}">${item.dietary_type}</span></td>
        <td><strong>${item.food_item}</strong></td>
        <td>${item.provider}</td>
        <td>${item.category}</td>
        <td class="mono">${item.quantity_kg} kg</td>
        <td><span class="status status-${statusClass}">${item.status}</span></td>
      </tr>`;
    }).join('');
  }

  function applyRoleUI(user) {
    // Update topbar role badge & user chip
    const roleEl = document.querySelector('.live-clock-role');
    if (roleEl) roleEl.textContent = (user.role || 'ADMIN').toUpperCase();

    const userChipSpan = document.querySelector('.user-chip span');
    if (userChipSpan) userChipSpan.textContent = user.display_name;

    // Show/hide Data Model nav link for admin
    const nav = document.querySelector('.sidebar nav');
    if (nav) {
      let dataLink = nav.querySelector('a[href="data.html"]');
      if (user.role === 'admin') {
        if (!dataLink) {
          dataLink = document.createElement('a');
          dataLink.className = 'nav-link';
          dataLink.href = 'data.html';
          dataLink.innerHTML = '<span>▦</span> Data model';
          nav.appendChild(dataLink);
        }
      } else if (dataLink) {
        dataLink.remove();
      }
    }

    // Show/hide "+ Add surplus" button for providers
    const topbarActions = document.querySelector('.topbar-actions');
    if (topbarActions) {
      let addBtn = topbarActions.querySelector('.topbar-add-surplus');
      if (user.role === 'provider') {
        if (!addBtn) {
          addBtn = document.createElement('a');
          addBtn.className = 'button button-dark topbar-add-surplus';
          addBtn.href = 'new_listing.html';
          addBtn.textContent = '＋ Add surplus';
          const userChip = topbarActions.querySelector('.user-chip');
          topbarActions.insertBefore(addBtn, userChip);
        }
      } else if (addBtn) {
        addBtn.remove();
      }

      // Inject Quick Role Switcher pills into topbar so visitors can test all 3 RBAC roles effortlessly
      if (!topbarActions.querySelector('.quick-role-switcher')) {
        const switcher = document.createElement('div');
        switcher.className = 'quick-role-switcher';
        switcher.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:rgba(23,37,30,0.06);padding:3px 6px;border-radius:999px;font-size:11px;font-family:"DM Mono",monospace;';
        const roles = [
          { key: 'admin', label: 'Admin', username: 'admin@rooted.local' },
          { key: 'tapmi', label: 'TAPMI', username: 'tapmi@rooted.local' },
          { key: 'ngo', label: 'NGO', username: 'ngo@rooted.local' }
        ];
        switcher.innerHTML = `<span style="opacity:0.65;padding:0 4px;">Role:</span>` + roles.map(r => {
          const active = user.username === r.username;
          const bg = active ? '#205d4f' : 'transparent';
          const col = active ? '#fff' : '#17251e';
          return `<button type="button" data-switch-user="${r.username}" style="border:none;background:${bg};color:${col};padding:3px 8px;border-radius:999px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:${active ? '600' : '400'};">${r.label}</button>`;
        }).join('');
        const clockBadge = topbarActions.querySelector('#live-clock-badge');
        topbarActions.insertBefore(switcher, clockBadge);

        switcher.querySelectorAll('button[data-switch-user]').forEach(btn => {
          btn.addEventListener('click', () => {
            const uname = btn.getAttribute('data-switch-user');
            const found = window.ROOTED_DB.users.find(u => u.username === uname);
            if (found) {
              setActiveUser(found);
              if (uname !== 'admin@rooted.local' && window.location.pathname.endsWith('data.html')) {
                window.location.href = 'index.html';
              } else {
                window.location.reload();
              }
            }
          });
        });
      }
    }

    const pageIntro = document.querySelector('.page-intro');
    if (pageIntro && window.location.pathname.endsWith('listings.html')) {
      let introBtn = pageIntro.querySelector('.intro-add-surplus');
      if (user.role === 'provider') {
        if (!introBtn) {
          introBtn = document.createElement('a');
          introBtn.className = 'button button-dark intro-add-surplus';
          introBtn.href = 'new_listing.html';
          introBtn.textContent = '＋ Add surplus';
          pageIntro.appendChild(introBtn);
        }
      } else if (introBtn) {
        introBtn.remove();
      }
    }
  }

  function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const uname = (document.getElementById('login-username')?.value || '').trim().toLowerCase();
      const pass = document.getElementById('login-password')?.value || '';
      const found = window.ROOTED_DB.users.find(u => u.username.toLowerCase() === uname && u.password === pass);
      if (found) {
        setActiveUser(found);
        window.location.href = 'index.html';
      } else {
        let stack = document.querySelector('.flash-stack');
        if (!stack) {
          stack = document.createElement('div');
          stack.className = 'flash-stack';
          stack.style.cssText = 'position: static; margin-bottom: 16px;';
          form.parentNode.insertBefore(stack, form);
        }
        stack.innerHTML = `<div class="flash error">That login ID or password is not recognised.</div>`;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign in →';
        }
      }
    });
  }

  function initDashboardPage(user) {
    const dashContent = document.querySelector('.dashboard-content');
    if (!dashContent) return;
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    const params = new URLSearchParams(window.location.search);
    const start = params.get('start') || (startInput ? startInput.value : window.ROOTED_DB.date_range.start);
    const end = params.get('end') || (endInput ? endInput.value : window.ROOTED_DB.date_range.end);
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;

    const providerId = user.role === 'provider' ? user.provider_id : null;
    const providerName = providerId && window.ROOTED_DB.providers[providerId]
      ? window.ROOTED_DB.providers[providerId].name
      : null;

    const heroCopy = dashContent.querySelector('.hero-copy');
    if (heroCopy) {
      heroCopy.textContent = (providerName ? `Your provider dashboard for ${providerName}: ` : '') +
        'a live view of food rescued, matched and moved through the redistribution network.';
    }

    const summary = computeSummary(start, end, providerId);
    window.dashboardData = summary.charts;
    if (typeof updateMetrics === 'function') updateMetrics(summary.insights);
    if (typeof renderCharts === 'function') renderCharts(summary.charts);
    renderRecentTable(summary.recent);
    const statusEl = document.getElementById('filter-status');
    if (statusEl) statusEl.textContent = `Showing ${summary.start} to ${summary.end}`;
  }

  function initListingsPage(user) {
    if (!window.location.pathname.endsWith('listings.html')) return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') || '';
    const dietaryType = params.get('dietary_type') || '';
    const foodSearch = (params.get('food') || '').trim();
    let page = Math.max(parseInt(params.get('page') || '1', 10) || 1, 1);
    const pageSize = 10;

    const { listings: allListings, claims: allClaims } = getMergedData();
    let filtered = allListings;

    if (user.role === 'provider' && user.provider_id) {
      filtered = filtered.filter(x => x.provider_id === user.provider_id);
    }
    if (['Available', 'Claimed', 'Completed', 'Expired'].includes(status)) {
      filtered = filtered.filter(x => x.status === status);
    }
    if (['Vegetarian', 'Non-vegetarian'].includes(dietaryType)) {
      filtered = filtered.filter(x => x.dietary_type === dietaryType);
    }
    if (foodSearch) {
      const q = foodSearch.toLowerCase();
      filtered = filtered.filter(x =>
        (x.food_item || '').toLowerCase().includes(q) ||
        (x.food_name || '').toLowerCase().includes(q) ||
        (x.provider || '').toLowerCase().includes(q) ||
        (x.location || '').toLowerCase().includes(q) ||
        (x.category || '').toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    page = Math.min(page, totalPages);
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

    // Update filter pills
    const filterGroup = document.querySelector('.filters-group');
    if (filterGroup) {
      const makeUrl = (newStatus, newDiet) => {
        const p = new URLSearchParams();
        if (newStatus) p.set('status', newStatus);
        if (newDiet) p.set('dietary_type', newDiet);
        if (foodSearch) p.set('food', foodSearch);
        const qs = p.toString();
        return 'listings.html' + (qs ? `?${qs}` : '');
      };
      let html = `<a class="filter ${!status && !dietaryType && !foodSearch ? 'selected' : ''}" href="listings.html">All</a>`;
      ['Vegetarian', 'Non-vegetarian'].forEach(opt => {
        const targetDiet = dietaryType === opt ? '' : opt;
        html += `<a class="filter ${dietaryType === opt ? 'selected' : ''}" href="${makeUrl(status, targetDiet)}">${opt}</a>`;
      });
      ['Available', 'Claimed', 'Completed', 'Expired'].forEach(opt => {
        const targetStatus = status === opt ? '' : opt;
        html += `<a class="filter ${status === opt ? 'selected' : ''}" href="${makeUrl(targetStatus, dietaryType)}">${opt}</a>`;
      });
      filterGroup.innerHTML = html;
    }

    // Update search form
    const searchForm = document.querySelector('form.food-search');
    if (searchForm) {
      const input = searchForm.querySelector('input[name="food"]');
      if (input) input.value = foodSearch;
    }

    // Update table header & rows
    const theadTr = document.querySelector('.table-panel thead tr');
    if (theadTr) {
      const hasReq = theadTr.querySelector('.th-ngo-req');
      if (user.role === 'ngo' && !hasReq) {
        const th = document.createElement('th');
        th.className = 'th-ngo-req';
        th.textContent = 'Request';
        theadTr.appendChild(th);
      } else if (user.role !== 'ngo' && hasReq) {
        hasReq.remove();
      }
    }

    const tbody = document.querySelector('.table-panel tbody');
    if (tbody) {
      if (pageRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${user.role === 'ngo' ? 10 : 9}" class="empty">No listings match this filter.</td></tr>`;
      } else {
        tbody.innerHTML = pageRows.map(item => {
          const dietClass = (item.dietary_type || '').toLowerCase().replace(/-/g, '');
          const statusClass = (item.status || '').toLowerCase().replace(/\s+/g, '-');
          const idStr = String(item.listing_id).padStart(4, '0');
          const remKg = Math.round(Number(item.remaining_kg) * 10) / 10;
          let ngoCol = '';
          if (user.role === 'ngo') {
            if (remKg > 0 && ['Available', 'Claimed'].includes(item.status)) {
              ngoCol = `<td>
                <form class="inline-claim" data-listing-id="${item.listing_id}">
                  <input name="quantity_kg" type="number" min="0.1" max="${remKg}" step="0.1" placeholder="kg" required>
                  <button class="button button-dark" type="submit">Claim</button>
                </form>
              </td>`;
            } else {
              ngoCol = `<td><span class="subline">Unavailable</span></td>`;
            }
          }
          return `<tr>
            <td><strong>#${idStr}</strong><span class="subline">${item.food_name}</span></td>
            <td><span class="diet diet-${dietClass}">${item.dietary_type}</span></td>
            <td><strong>${item.food_item}</strong></td>
            <td>${item.provider}</td>
            <td>${item.location}</td>
            <td>${item.category}</td>
            <td class="mono">${remKg} kg</td>
            <td class="mono">${String(item.expiry_at).slice(0, 16)}</td>
            <td><span class="status status-${statusClass}">${item.status}</span></td>
            ${ngoCol}
          </tr>`;
        }).join('');

        // Bind NGO claim forms
        tbody.querySelectorAll('form.inline-claim').forEach(f => {
          f.addEventListener('submit', (e) => {
            e.preventDefault();
            const listingId = parseInt(f.getAttribute('data-listing-id'), 10);
            const qty = parseFloat(f.querySelector('input[name="quantity_kg"]').value);
            const listing = allListings.find(x => x.listing_id === listingId);
            if (!listing || isNaN(qty) || qty <= 0 || qty > listing.remaining_kg) {
              setFlash('error', 'That quantity is no longer available. Please choose a smaller amount.');
              window.location.reload();
              return;
            }
            const customClaims = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_CLAIMS) || '[]');
            const maxId = allClaims.reduce((m, c) => Math.max(m, c.claim_id), 0);
            const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
            const receiverId = user.receiver_id || 1;
            const receiverName = (window.ROOTED_DB.receivers[receiverId] || { name: user.display_name }).name;
            customClaims.unshift({
              claim_id: maxId + 1,
              listing_id: listing.listing_id,
              receiver_id: receiverId,
              provider_id: listing.provider_id,
              food_name: listing.food_name,
              food_item: listing.food_item,
              dietary_type: listing.dietary_type,
              category: listing.category,
              provider: listing.provider,
              receiver: receiverName,
              claimed_kg: qty,
              claimed_at: nowStr,
              pickup_at: null,
              status: 'Pending'
            });
            localStorage.setItem(STORAGE_KEYS.CUSTOM_CLAIMS, JSON.stringify(customClaims));
            setFlash('success', 'Food request submitted to the provider.');
            window.location.href = 'claims.html';
          });
        });
      }
    }

    // Update pagination
    const pagSummary = document.querySelector('.pagination-summary');
    if (pagSummary) {
      pagSummary.textContent = `Showing page ${page} of ${totalPages} · ${total} listings (10 per page)`;
    }
    const pagLinks = document.querySelector('.pagination-links');
    if (pagLinks) {
      const pageUrl = (pNum) => {
        const p = new URLSearchParams();
        p.set('page', String(pNum));
        if (status) p.set('status', status);
        if (dietaryType) p.set('dietary_type', dietaryType);
        if (foodSearch) p.set('food', foodSearch);
        return 'listings.html?' + p.toString();
      };
      const startP = Math.max(1, page - 2);
      const endP = Math.min(totalPages, page + 2);
      let pills = '';
      for (let p = startP; p <= endP; p++) {
        pills += `<a class="page-pill ${p === page ? 'active' : ''}" href="${pageUrl(p)}">${p}</a>`;
      }
      pagLinks.innerHTML = `
        ${page > 1 ? `<a class="button button-light" href="${pageUrl(page - 1)}">← Previous</a>` : `<span class="button button-light disabled">← Previous</span>`}
        <div class="pagination-pages">${pills}</div>
        ${page < totalPages ? `<a class="button button-dark" href="${pageUrl(page + 1)}">Next page →</a>` : `<span class="button button-light disabled">Next page →</span>`}
      `;
    }
  }

  function initClaimsPage(user) {
    if (!window.location.pathname.endsWith('claims.html')) return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') || '';
    const searchQuery = (params.get('q') || '').trim();
    let page = Math.max(parseInt(params.get('page') || '1', 10) || 1, 1);
    const pageSize = 10;

    const { claims: allClaims } = getMergedData();
    let filtered = allClaims;

    if (user.role === 'provider' && user.provider_id) {
      filtered = filtered.filter(x => x.provider_id === user.provider_id);
    }
    if (['Pending', 'Collected', 'Completed', 'Cancelled'].includes(status)) {
      filtered = filtered.filter(x => x.status === status);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(x => {
        const code = `cl-${String(x.claim_id).padStart(4, '0')}`;
        return code.includes(q) ||
          (x.food_name || '').toLowerCase().includes(q) ||
          (x.food_item || '').toLowerCase().includes(q) ||
          (x.provider || '').toLowerCase().includes(q) ||
          (x.receiver || '').toLowerCase().includes(q) ||
          (x.category || '').toLowerCase().includes(q);
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    page = Math.min(page, totalPages);
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

    const filterGroup = document.querySelector('.filters-group');
    if (filterGroup) {
      const makeUrl = (newStatus) => {
        const p = new URLSearchParams();
        if (newStatus) p.set('status', newStatus);
        if (searchQuery) p.set('q', searchQuery);
        const qs = p.toString();
        return 'claims.html' + (qs ? `?${qs}` : '');
      };
      let html = `<a class="filter ${!status && !searchQuery ? 'selected' : ''}" href="claims.html">All</a>`;
      ['Pending', 'Collected', 'Completed', 'Cancelled'].forEach(opt => {
        const target = status === opt ? '' : opt;
        html += `<a class="filter ${status === opt ? 'selected' : ''}" href="${makeUrl(target)}">${opt}</a>`;
      });
      filterGroup.innerHTML = html;
    }

    const searchForm = document.querySelector('form.food-search');
    if (searchForm) {
      const input = searchForm.querySelector('input[name="q"]');
      if (input) input.value = searchQuery;
    }

    const canAct = ['admin', 'provider'].includes(user.role);
    const theadTr = document.querySelector('.table-panel thead tr');
    if (theadTr) {
      const hasAct = theadTr.querySelector('.th-claim-act');
      if (!canAct && hasAct) hasAct.remove();
    }

    const tbody = document.querySelector('.table-panel tbody');
    if (tbody) {
      if (pageRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${canAct ? 10 : 9}" class="empty">No claims match this status or search filter.</td></tr>`;
      } else {
        tbody.innerHTML = pageRows.map(claim => {
          const dietClass = (claim.dietary_type || '').toLowerCase().replace(/-/g, '');
          const statusClass = (claim.status || '').toLowerCase().replace(/\s+/g, '-');
          const idStr = String(claim.claim_id).padStart(4, '0');
          let actCol = '';
          if (canAct) {
            if (claim.status === 'Pending') {
              actCol = `<td>
                <form class="claim-action-form" data-claim-id="${claim.claim_id}">
                  <select name="status">
                    <option value="Collected">Mark Collected</option>
                    <option value="Completed">Mark Completed</option>
                    <option value="Cancelled">Cancel Claim</option>
                  </select>
                  <button class="button button-light" type="submit">Update</button>
                </form>
              </td>`;
            } else {
              actCol = `<td><span class="subline">Finalized</span></td>`;
            }
          }
          return `<tr>
            <td class="mono">CL-${idStr}</td>
            <td><strong>${claim.food_name}</strong><span class="subline">${claim.category}</span></td>
            <td><span class="diet diet-${dietClass}">${claim.dietary_type}</span></td>
            <td><strong>${claim.food_item}</strong></td>
            <td>${claim.provider}</td>
            <td>${claim.receiver}</td>
            <td class="mono">${claim.claimed_kg} kg</td>
            <td class="mono">${String(claim.claimed_at).slice(0, 16)}</td>
            <td><span class="status status-${statusClass}">${claim.status}</span></td>
            ${actCol}
          </tr>`;
        }).join('');

        tbody.querySelectorAll('form.claim-action-form').forEach(f => {
          f.addEventListener('submit', (e) => {
            e.preventDefault();
            const claimId = parseInt(f.getAttribute('data-claim-id'), 10);
            const newStatus = f.querySelector('select[name="status"]').value;
            const updates = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLAIM_UPDATES) || '{}');
            updates[claimId] = {
              status: newStatus,
              pickup_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
            };
            localStorage.setItem(STORAGE_KEYS.CLAIM_UPDATES, JSON.stringify(updates));
            setFlash('success', `Claim #${String(claimId).padStart(4, '0')} updated to ${newStatus}.`);
            window.location.reload();
          });
        });
      }
    }

    const pagSummary = document.querySelector('.pagination-summary');
    if (pagSummary) {
      pagSummary.textContent = `Showing page ${page} of ${totalPages} · ${total} claims (10 per page)`;
    }
    const pagLinks = document.querySelector('.pagination-links');
    if (pagLinks) {
      const pageUrl = (pNum) => {
        const p = new URLSearchParams();
        p.set('page', String(pNum));
        if (status) p.set('status', status);
        if (searchQuery) p.set('q', searchQuery);
        return 'claims.html?' + p.toString();
      };
      const startP = Math.max(1, page - 2);
      const endP = Math.min(totalPages, page + 2);
      let pills = '';
      for (let p = startP; p <= endP; p++) {
        pills += `<a class="page-pill ${p === page ? 'active' : ''}" href="${pageUrl(p)}">${p}</a>`;
      }
      pagLinks.innerHTML = `
        ${page > 1 ? `<a class="button button-light" href="${pageUrl(page - 1)}">← Previous</a>` : `<span class="button button-light disabled">← Previous</span>`}
        <div class="pagination-pages">${pills}</div>
        ${page < totalPages ? `<a class="button button-dark" href="${pageUrl(page + 1)}">Next page →</a>` : `<span class="button button-light disabled">Next page →</span>`}
      `;
    }
  }

  function initNewListingPage(user) {
    if (!window.location.pathname.endsWith('new_listing.html')) return;
    const form = document.querySelector('form.form-layout');
    if (!form) return;
    const locInput = form.querySelector('input[name="location"]');
    const provInfo = user.provider_id && window.ROOTED_DB.providers[user.provider_id]
      ? window.ROOTED_DB.providers[user.provider_id]
      : { name: 'TAPMI Campus Dining', location: 'Manipal' };
    if (locInput && !locInput.value) locInput.value = provInfo.location;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const foodName = form.querySelector('input[name="food_name"]').value.trim();
      const dietaryType = form.querySelector('select[name="dietary_type"]').value;
      const foodItem = form.querySelector('input[name="food_item"]').value.trim();
      const location = form.querySelector('input[name="location"]').value.trim();
      const category = form.querySelector('select[name="category"]').value;
      const qty = parseFloat(form.querySelector('input[name="quantity_kg"]').value);
      const listedAt = form.querySelector('input[name="listed_at"]').value.replace('T', ' ');
      const expiryAt = form.querySelector('input[name="expiry_at"]').value.replace('T', ' ');
      const desc = form.querySelector('textarea[name="description"]').value.trim();

      if (!foodName || !foodItem || isNaN(qty) || qty <= 0 || expiryAt <= listedAt) {
        setFlash('error', 'Check the required fields and make sure the expiry is after the listing time.');
        window.location.reload();
        return;
      }

      const { listings: allListings } = getMergedData();
      const maxId = allListings.reduce((m, l) => Math.max(m, l.listing_id), 0);
      const customListings = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_LISTINGS) || '[]');
      customListings.unshift({
        listing_id: maxId + 1,
        provider_id: user.provider_id || 121,
        provider: provInfo.name,
        food_name: foodName,
        food_item: foodItem,
        dietary_type: dietaryType,
        location: location || 'Manipal',
        category: category,
        meal_type: 'Lunch',
        quantity_kg: qty,
        remaining_kg: qty,
        listed_at: listedAt.length === 16 ? listedAt + ':00' : listedAt,
        expiry_at: expiryAt.length === 16 ? expiryAt + ':00' : expiryAt,
        status: 'Available',
        description: desc
      });
      localStorage.setItem(STORAGE_KEYS.CUSTOM_LISTINGS, JSON.stringify(customListings));
      setFlash('success', 'Surplus listing added to the live inventory.');
      window.location.href = 'listings.html';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLoginPage();
    const user = getActiveUser();
    applyRoleUI(user);
    showPendingFlash();
    initDashboardPage(user);
    initListingsPage(user);
    initClaimsPage(user);
    initNewListingPage(user);
  });
})();
