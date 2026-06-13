/* ==========================================================================
   IMPERIAL RESERVATIONS — Main Application Logic (Full DB Sync)
   ========================================================================== */

const $ = id => document.getElementById(id);
const sym = () => store.data.settings.currency_symbol || 'Rs.';

function generateLocalBookingNo() {
    const now = new Date();
    return `BKG-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const toast = $('toast');
    const icons  = { success: 'fa-circle-check', danger: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const colors = { success: '#10b981', danger: '#ef4444', info: '#00f2fe', warning: '#f59e0b' };
    toast.innerHTML = `<i class="fa-solid ${icons[type]}" style="color:${colors[type]};margin-right:10px;"></i>${msg}`;
    toast.style.display = 'block';
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.style.display = 'none', 3500);
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function openModal(id)  { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function statusBadge(status) {
    const map = {
        Confirmed: 'badge-success', Pending: 'badge-warning', Cancelled: 'badge-danger',
        Available: 'badge-success', Booked: 'badge-info', Maintenance: 'badge-danger'
    };
    const dot = { Confirmed: '🟢', Pending: '🟡', Cancelled: '🔴', Available: '🟢', Booked: '🔵', Maintenance: '🔴' };
    return `<span class="badge ${map[status] || 'badge-info'}">${status}</span>`;
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(v) {
    return `${sym()}${parseFloat(v || 0).toLocaleString()}`;
}

const EVENT_MENU = {
    "Action Station (Live Cooking Station)": ["Pasta (Alfredo / Bolognese / Carbonara)", "Fried noodles (Chicken / Seafood / Vegetable)", "Omelette (cheese, mushroom, onion, chili options)", "Dosa / Hoppers (Sri Lankan live station)", "Stir-fried rice (egg / chicken / mixed)", "Carving roast chicken / beef slices"],
    "Appetizers / Starters": ["Chicken spring rolls", "Vegetable samosas", "Garlic bread bites", "Devilled chicken / fish", "Prawn cocktail", "Mini sliders (beef or chicken)", "Stuffed mushrooms"],
    "Main Course": ["Chicken curry (Sri Lankan / Indian style)", "Beef curry", "Fish ambul thiyal", "Vegetable korma", "Fried rice / steamed rice", "Pasta with sauces", "Grilled chicken steak", "Lamb stew"],
    "Desserts / Sweet / Dessert Live Station": ["Chocolate fountain with fruits", "Ice cream (vanilla, chocolate, strawberry)", "Watalappan (Sri Lankan dessert)", "Cheesecake slices", "Fruit salad", "Pancakes with toppings (live station)", "Chocolate mousse"],
    "Beverage Station": ["Fresh lime juice", "Orange juice", "Mango juice", "Soft drinks (cola, sprite)", "Tea (black / milk tea)", "Coffee (espresso / cappuccino)", "Mocktails (mojito, sunrise)"],
    "Bakery / Bread Station": ["Croissants", "Dinner rolls", "Garlic bread", "Baguette slices", "Muffins (chocolate / blueberry)", "Danish pastries", "Butter & jam spreads"],
    "Salad Bar": ["Lettuce, cucumber, tomato mix", "Beetroot salad", "Coleslaw", "Pasta salad", "Potato salad", "Corn salad", "Dressings (vinaigrette, mayo, yogurt)"],
    "Soup Station": ["Chicken clear soup", "Cream of mushroom soup", "Sweet corn soup", "Pumpkin soup", "Seafood soup", "Lentil soup (dal soup)"],
    "Live Grill / BBQ Station": ["Grilled chicken skewers", "Beef steak slices", "Grilled prawns", "BBQ sausages", "Grilled fish fillets", "Vegetable skewers (capsicum, mushroom, onion)"]
};

function renderMenuOptions(containerId, prefix, prefillJSON = null) {
    const container = $(containerId);
    if (!container) return;
    const selectedMap = prefillJSON ? (typeof prefillJSON === 'string' ? JSON.parse(prefillJSON) : prefillJSON) : {};
    
    let tabsHtml = `<div class="menu-tabs-container" style="display:flex; overflow-x:auto; gap:8px; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">`;
    let contentHtml = `<div class="menu-content-container" style="min-height:150px;">`;
    
    let first = true;
    for (const [category, items] of Object.entries(EVENT_MENU)) {
        const catId = category.replace(/[^a-zA-Z0-9]/g, '');
        
        tabsHtml += `<button type="button" class="btn btn-outline btn-sm ${prefix}-menu-tab-btn" 
            onclick="window.switchMenuTab(event, '${prefix}', '${prefix}-${catId}')" 
            style="white-space:nowrap; ${first ? 'background:var(--primary);color:#fff;border-color:var(--primary);' : ''}">
            ${category}
        </button>`;
        
        contentHtml += `<div id="${prefix}-${catId}" class="${prefix}-menu-tab-content" style="display:${first ? 'block' : 'none'};">
            <h5 style="color:var(--primary); margin-bottom:10px;">${category}</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
        
        items.forEach(item => {
            const isChecked = selectedMap[category] && selectedMap[category].includes(item);
            contentHtml += `<label style="font-size: 13px; display: flex; align-items: flex-start; gap: 8px; cursor: pointer; padding:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:6px;">
                <input type="checkbox" class="${prefix}-menu-cb" data-category="${category}" value="${item}" ${isChecked ? 'checked' : ''} onchange="window.handleMenuCheckboxChange(event)" style="margin-top:2px; flex-shrink: 0;">
                <span style="line-height:1.2;">${item}</span>
            </label>`;
        });
        contentHtml += `</div></div>`;
        first = false;
    }
    
    tabsHtml += `</div>`;
    contentHtml += `</div>`;
    
    container.innerHTML = tabsHtml + contentHtml;
}

window.switchMenuTab = function(e, prefix, targetId) {
    document.querySelectorAll(`.${prefix}-menu-tab-content`).forEach(el => el.style.display = 'none');
    document.querySelectorAll(`.${prefix}-menu-tab-btn`).forEach(btn => {
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
    });
    const target = document.getElementById(targetId);
    if (target) target.style.display = 'block';
    const btn = e.currentTarget;
    btn.style.background = 'var(--primary)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--primary)';
};

window.handleMenuCheckboxChange = function(e) {
    const cb = e.target;
    const category = cb.getAttribute('data-category');
    let prefix = 'res';
    if (cb.classList.contains('inq-menu-cb')) prefix = 'inq';

    const checkedCount = document.querySelectorAll(`.${prefix}-menu-cb[data-category="${category}"]:checked`).length;
    
    if (checkedCount > 3 && cb.checked) {
        showToast(`Warning: Selecting more than 3 items in "${category}" will require Sales Approval.`, 'warning');
    }
};

function getMenuSelections(prefix) {
    const checkboxes = document.querySelectorAll(`.${prefix}-menu-cb:checked`);
    const selections = {};
    let requiresApproval = false;
    checkboxes.forEach(cb => {
        const cat = cb.getAttribute('data-category');
        if (!selections[cat]) selections[cat] = [];
        selections[cat].push(cb.value);
    });
    for (const cat in selections) {
        if (selections[cat].length > 3) requiresApproval = true;
    }
    return { menu_selections: Object.keys(selections).length ? selections : null, requiresApproval };
}

// ─── Router ──────────────────────────────────────────────────────────────────
const routes = {
    '/login':     renderLogin,
    '/dashboard': renderDashboard,
    '/customers': renderCustomers,
    '/inquiry':   renderInquiry,
    '/booking':   renderBooking,
    '/events':    renderEvents,
    '/rooms':     renderRooms,
    '/hotel-rooms': renderHotelRooms,
        '/hotel-bookings': renderHotelBookings,
    '/agreement': renderAgreement,
    '/approval':  renderApproval,
    '/finance':   renderFinance,
    '/calendar':  renderCalendar,
    '/reports':   renderReports,
    '/payments':  renderPayments,
    '/settings':  renderSettings
};

let currentRoute = '/dashboard';

function navigate(route) {
    if (!store.data.currentUser && route !== '/login') {
        window.location.hash = '#/login';
        return;
    }

    if (store.data.currentUser) {
        if (store.data.currentUser.role === 'finance' && route !== '/finance' && route !== '/login') {
            window.location.hash = '#/finance';
            return;
        }
        if (route === '/login') {
            window.location.hash = store.data.currentUser.role === 'finance' ? '#/finance' : '#/dashboard';
            return;
        }
    }

    if (!routes[route]) route = '/dashboard';
    currentRoute = route;
    
    const sidebar = document.getElementById('sidebar');
    const topbar = document.querySelector('.topbar');
    if (route === '/login') {
        if (sidebar) sidebar.style.display = 'none';
        if (topbar) topbar.style.display = 'none';
        document.body.style.background = 'transparent'; // Let login css handle bg
    } else {
        if (sidebar) sidebar.style.display = 'flex';
        if (topbar) topbar.style.display = 'flex';
        document.body.style.background = '';
    }

    document.querySelectorAll('.nav-item[data-route]').forEach(el =>
        el.classList.toggle('active', el.getAttribute('data-route') === route)
    );
    const view = $('app-view');
    view.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'page-enter';
    view.appendChild(wrapper);
    routes[route](wrapper);
}

function renderLogin(container) {
    if (!document.getElementById('login-css')) {
        const link = document.createElement('link');
        link.id = 'login-css';
        link.rel = 'stylesheet';
        link.href = 'assets/css/login.css'; 
        document.head.appendChild(link);
    }

    container.innerHTML = `
        <div class="login-layout">
            <div class="login-card">
                <div class="login-logo">
                    <div class="logo-icon"><i class="fa-solid fa-hotel"></i></div>
                    <div class="logo-text">
                        <span class="brand-top">Ascendia</span>
                        <span class="brand-main">Reservations</span>
                    </div>
                </div>
                <form class="login-form" id="loginForm">
                    <div class="login-error" id="loginError"></div>
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="username" placeholder="Enter your username" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="password" placeholder="Enter your password" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-login">Login</button>
                </form>
                <div style="margin-top:24px; text-align:center; font-size:11px; color:rgba(255,255,255,0.3); letter-spacing:0.4px;">
                    &copy; 2026 All Rights Reserved. <span style="color:rgba(0,242,254,0.5); font-weight:600;">Ascendia Solutions.</span>
                </div>
            </div>
        </div>
    `;

    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('username');
        const p = document.getElementById('password');
        const errDiv = document.getElementById('loginError');
        
        if (!u.value.trim() || !p.value.trim()) return;

        const res = await store.login(u.value.trim(), p.value);
        if (res.success) {
            window.location.hash = '#/dashboard';
        } else {
            errDiv.textContent = res.error;
            errDiv.style.display = 'block';
        }
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await store.init();

    window.addEventListener('auth_changed', () => {
        const u = store.data.currentUser;
        if (u) {
            const nameEl = document.querySelector('.user-name');
            const roleEl = document.querySelector('.user-role');
            if (nameEl) nameEl.textContent = u.name;
            if (roleEl) roleEl.textContent = u.role.charAt(0).toUpperCase() + u.role.slice(1);

            // Handle sidebar visibility based on role
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
                const route = el.getAttribute('data-route');
                if (u.role === 'finance') {
                    if (route === '/finance') {
                        el.style.display = 'flex';
                    } else {
                        el.style.display = 'none';
                    }
                } else {
                    el.style.display = 'flex';
                }
            });
        }
    });
    // Trigger it on load if user is logged in
    window.dispatchEvent(new CustomEvent('auth_changed'));

    // Handle logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            store.logout();
            window.location.hash = '#/login';
        });
    }

    // Handle notifications
    const notifBellBtn = document.getElementById('notifBellBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    if (notifBellBtn && notifDropdown) {
        notifBellBtn.addEventListener('click', () => {
            notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', (e) => {
            if (!notifBellBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
                notifDropdown.style.display = 'none';
            }
        });
    }

    window.addEventListener('notifications_updated', () => {
        const notifs = store.data.notifications || [];
        const badge = document.getElementById('notifBadge');
        const list = document.getElementById('notifList');
        if (!badge || !list) return;

        if (notifs.length > 0) {
            badge.textContent = notifs.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        if (notifs.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">No new notifications</div>';
        } else {
            list.innerHTML = notifs.map(n => `
                <div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;" onclick="markNotifRead(${n.id})">
                    <div style="font-size:13px; color:var(--text-main); margin-bottom:5px;">${n.message}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${new Date(n.created_at).toLocaleString()}</div>
                </div>
            `).join('');
        }
    });

    window.addEventListener('hashchange', () => navigate(window.location.hash.slice(1) || '/dashboard'));

    $('refreshBtn').addEventListener('click', async () => {
        const icon = $('refreshBtn').querySelector('i');
        icon.style.transition = 'transform 0.5s';
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => { icon.style.transform = ''; }, 500);
        await store.refreshData();
        showToast('Data refreshed from database', 'success');
    });

    $('globalSearch').addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        if (q.length < 2) return;
        const r = store.data.reservations.filter(r =>
            (r.event_name || '').toLowerCase().includes(q) ||
            (r.customer_name || '').toLowerCase().includes(q) ||
            (r.customer_phone || '').toLowerCase().includes(q)
        );
        const c = store.data.customers.filter(cu =>
            (cu.name || '').toLowerCase().includes(q) ||
            (cu.phone || '').toLowerCase().includes(q)
        );
        if (r.length || c.length)
            showToast(`Found: ${r.length} reservation(s), ${c.length} customer(s)`, 'info');
    });

    navigate(window.location.hash.slice(1) || '/dashboard');
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESERVATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function switchResModalTab(tab) {
    $('resTabGeneralBtn').classList.remove('active');
    $('resTabMenuBtn').classList.remove('active');
    $('resTabBillsBtn').classList.remove('active');
    $('resTabGeneralContent').style.display = 'none';
    $('resTabMenuContent').style.display = 'none';
    $('resTabBillsContent').style.display = 'none';

    if (tab === 'General') {
        $('resTabGeneralBtn').classList.add('active');
        $('resTabGeneralContent').style.display = 'block';
    } else if (tab === 'Menu') {
        $('resTabMenuBtn').classList.add('active');
        $('resTabMenuContent').style.display = 'block';
    } else if (tab === 'Bills') {
        $('resTabBillsBtn').classList.add('active');
        $('resTabBillsContent').style.display = 'block';
    }
}

let _editingReservationId = null;

function openReservationModal(prefillOrId = null) {
    const prefill = (prefillOrId && typeof prefillOrId !== 'object') ? store.data.reservations.find(r => r.id === prefillOrId) : prefillOrId;
    _editingReservationId = prefill ? prefill.id : null;
    const sel = $('res_room_id');
    sel.innerHTML = `<option value="">-- No Venue --</option>` +
        store.data.eventRooms.map(r =>
            `<option value="${r.id}" ${prefill && prefill.room_id == r.id ? 'selected' : ''}>${r.name} (${sym()}${r.price_per_day}/day · Cap:${r.capacity})</option>`
        ).join('');

    const inqSel = $('res_inquiry_ref_no');
    inqSel.innerHTML = `<option value="">-- Select Inquiry (Optional) --</option>` +
        store.data.inquiries.map(inq =>
            `<option value="${inq.ref_no}" ${prefill && prefill.inquiry_ref_no === inq.ref_no ? 'selected' : ''}>${inq.ref_no} — ${inq.customer_name} (${inq.event_type})</option>`
        ).join('');

    inqSel.onchange = (e) => {
        const ref = e.target.value;
        if (!ref) return;
        const inq = store.data.inquiries.find(i => i.ref_no === ref);
        if (inq) {
            $('res_event_name').value = inq.event_type || '';
            $('res_customer_name').value = inq.customer_name || '';
            $('res_customer_phone').value = inq.customer_phone || '';
            if (inq.preferred_room_id) $('res_room_id').value = inq.preferred_room_id;
            if (inq.preferred_date) $('res_date_start').value = inq.preferred_date.split('T')[0];
            if (inq.num_guests) $('res_num_guests').value = inq.num_guests;
            if (inq.budget) $('res_total_price').value = inq.budget;
            if (inq.menu_selections) renderMenuOptions('res_menu_container', 'res', inq.menu_selections);
        }
    };

    $('res_booking_no').value = prefill ? (prefill.booking_no || '') : generateLocalBookingNo();

    const fields = ['res_event_name','res_customer_name','res_customer_phone','res_date_start','res_date_end','res_num_guests','res_total_price'];
    const values = prefill
        ? [prefill.event_name, prefill.customer_name, prefill.customer_phone,
           prefill.date_start ? prefill.date_start.split('T')[0] : '',
           prefill.date_end   ? prefill.date_end.split('T')[0] : '',
           prefill.num_guests, prefill.total_price]
        : ['','','','','','',''];
    fields.forEach((id, i) => $(id).value = values[i] || '');
    if (prefill) $('res_status').value = prefill.status || 'Pending';

    renderMenuOptions('res_menu_container', 'res', prefill ? prefill.menu_selections : null);

    $('reservationModalTitleText').innerHTML = _editingReservationId ? 'Edit Reservation' : 'New Reservation';

    // Fetch and display bills if editing
    if (_editingReservationId) {
        fetch(`/api/reservations/${_editingReservationId}/orders`)
            .then(res => res.json())
            .then(orders => {
                const container = $('res_bills_container');
                if (!orders || orders.length === 0) {
                    container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">No restaurant bills found for this reservation.</div>';
                } else {
                    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
                    let grandTotal = 0;
                    orders.forEach(o => {
                        grandTotal += o.total;
                        const date = new Date(o.date).toLocaleString();
                        html += `
                            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:15px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                                    <div><strong>Order ID:</strong> ${o.id} <span style="margin-left:10px; font-size:12px; color:var(--primary);">${o.status}</span></div>
                                    <div style="font-size:12px; color:var(--text-muted);">${date}</div>
                                </div>
                                <div style="font-size:13px; margin-bottom:10px;">
                                    ${o.items && o.items.map(i => `<div>${i.qty}x ${i.dish_name} - ${sym()}${(i.price * i.qty).toFixed(2)}</div>`).join('')}
                                </div>
                                <div style="text-align:right; font-weight:bold; color:var(--primary);">
                                    Total: ${sym()}${o.total.toFixed(2)}
                                </div>
                            </div>
                        `;
                    });
                    html += `
                        <div style="margin-top:15px; text-align:right; font-size:16px; font-weight:bold;">
                            Grand Total: ${sym()}${grandTotal.toFixed(2)}
                        </div>
                    `;
                    html += '</div>';
                    container.innerHTML = html;
                }
            })
            .catch(err => {
                $('res_bills_container').innerHTML = '<div style="text-align:center; padding:30px; color:#ef4444;">Failed to load restaurant bills.</div>';
            });
    } else {
        $('res_bills_container').innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Save reservation to view linked bills.</div>';
    }

    switchResModalTab('General');

    openModal('reservationModal');
}

async function submitReservation() {
    const body = {
        booking_no:      $('res_booking_no').value.trim(),
        inquiry_ref_no:  $('res_inquiry_ref_no').value || null,
        event_name:      $('res_event_name').value.trim(),
        customer_name:   $('res_customer_name').value.trim(),
        customer_phone:  $('res_customer_phone').value.trim(),
        room_id:         $('res_room_id').value || null,
        date_start:      $('res_date_start').value,
        date_end:        $('res_date_end').value,
        num_guests:      $('res_num_guests').value,
        status:          $('res_status').value,
        total_price:     $('res_total_price').value
    };

    const menuData = getMenuSelections('res');
    body.menu_selections = menuData.menu_selections;
    if (menuData.requiresApproval) {
        body.status = 'Pending';
        showToast('More than 3 items selected per category. Forcing status to Pending for Sales Approval.', 'info');
    }
    
    // Front-end Validations
    if (!body.event_name) { showToast('Event name is required', 'warning'); return; }
    if (!body.customer_name) { showToast('Customer name is required', 'warning'); return; }
    if (!body.customer_phone) { showToast('Customer phone is required', 'warning'); return; }
    if (body.customer_phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(body.customer_phone)) { showToast('Invalid phone number format', 'warning'); return; }
    if (!body.date_start) { showToast('Start date is required', 'warning'); return; }
    if (body.date_end && new Date(body.date_start) > new Date(body.date_end)) { showToast('End date cannot be before start date', 'warning'); return; }
    if (body.num_guests && body.num_guests < 1) { showToast('Number of guests must be at least 1', 'warning'); return; }
    if (body.total_price && body.total_price < 0) { showToast('Total price cannot be negative', 'warning'); return; }

    const overlaps = checkOverlap(body.room_id, body.date_start, body.date_end, _editingReservationId);
    if (overlaps && body.status === 'Confirmed') {
        if (confirm('⚠️ VENUE OVERLAP CONFLICT!\n\nThis room/venue is already booked for the selected dates. Would you like to add the customer to the Waitlist queue instead?')) {
            try {
                await store.fetchAPI('/waitlist', {
                    method: 'POST',
                    body: JSON.stringify({
                        room_id: body.room_id,
                        customer_name: body.customer_name,
                        customer_phone: body.customer_phone,
                        date_start: body.date_start,
                        date_end: body.date_end,
                        num_guests: body.num_guests,
                        event_name: body.event_name,
                        notes: body.notes || ''
                    })
                });
                await store.refreshData();
                showToast('Customer added to the Waitlist queue ✓', 'success');
                closeModal('reservationModal');
            } catch (err) {
                showToast('Failed to add to Waitlist: ' + err.message, 'danger');
            }
        }
        return;
    }

    try {
        if (_editingReservationId) {
            await store.fetchAPI(`/reservations/${_editingReservationId}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Reservation updated in database ✓', 'success');
        } else {
            await store.fetchAPI('/reservations', { method: 'POST', body: JSON.stringify(body) });
            showToast('Reservation saved to database ✓', 'success');
        }
        closeModal('reservationModal');
        await store.refreshData();
    } catch (e) { showToast('Database error: ' + e.message, 'danger'); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS UPDATE (Confirm / Cancel)
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// INQUIRY WIZARD MODAL
// ═══════════════════════════════════════════════════════════════════════════════

let _inqStep = 1;
let _editingInquiryId = null;

function openInquiryModal(inqOrId = null) {
    const inq = (inqOrId && typeof inqOrId !== 'object') ? store.data.inquiries.find(i => i.id === inqOrId) : inqOrId;
    _editingInquiryId = inq ? inq.id : null;
    _inqStep = 1;

    // Populate room dropdown
    const sel = $('inq_room_id');
    sel.innerHTML = `<option value="">-- No Preference --</option>` +
        store.data.eventRooms.map(r => `<option value="${r.id}" ${inq && inq.preferred_room_id == r.id ? 'selected' : ''}>${r.name} (Cap: ${r.capacity})</option>`).join('');

    // Clear or prefill
    const fields = {
        inq_customer_name:  inq ? inq.customer_name  : '',
        inq_customer_phone: inq ? inq.customer_phone : '',
        inq_customer_email: inq ? inq.customer_email : '',
        inq_assigned_to:    inq ? inq.assigned_to    : '',
        inq_preferred_date: inq && inq.preferred_date ? inq.preferred_date.split('T')[0] : '',
        inq_num_guests:     inq ? inq.num_guests     : '',
        inq_budget:         inq ? inq.budget         : '',
        inq_follow_up_date: inq && inq.follow_up_date ? inq.follow_up_date.split('T')[0] : '',
        inq_requirements:   inq ? inq.requirements   : '',
        inq_notes:          inq ? inq.notes          : ''
    };
    Object.entries(fields).forEach(([id, val]) => { if ($(id)) $(id).value = val || ''; });

    if (inq) {
        if ($('inq_source'))        $('inq_source').value      = inq.source     || 'Walk-in';
        if ($('inq_event_type'))    $('inq_event_type').value  = inq.event_type || 'Wedding';
        if ($('inq_flexible_date')) $('inq_flexible_date').checked = !!inq.flexible_date;
    }

    $('inquiryModalTitle').innerHTML = `<i class="fa-solid fa-clipboard-question" style="color:var(--primary);margin-right:10px;"></i>${_editingInquiryId ? 'Edit Inquiry' : 'New Inquiry'}`;
    renderMenuOptions('inq_menu_container', 'inq', inq ? inq.menu_selections : null);
    _inqGoToStep(1);
    openModal('inquiryModal');
}

function _inqGoToStep(step) {
    _inqStep = step;
    [1,2,3,4].forEach(s => {
        const el = $(`inq-step-${s}`);
        if (el) el.style.display = s === step ? '' : 'none';
        const dot = $(`step-dot-${s}`);
        if (dot) {
            dot.className = `inq-step ${s < step ? 'done' : s === step ? 'active' : ''}`;
            dot.innerHTML = s < step ? '<i class="fa-solid fa-check" style="font-size:12px;"></i>' : s;
        }
    });
    // Update lines
    document.querySelectorAll('.inq-step-line').forEach((line, i) => {
        line.className = `inq-step-line ${i < step - 1 ? 'done' : ''}`;
    });

    $('inqPrevBtn').style.display  = step > 1 ? '' : 'none';
    $('inqNextBtn').style.display  = step < 4 ? '' : 'none';
    $('inqSubmitBtn').style.display = step === 4 ? '' : 'none';
}

function inqNext() {
    if (_inqStep === 1) {
        if (!$('inq_customer_name').value.trim()) { showToast('Customer name is required', 'warning'); return; }
        const phone = $('inq_customer_phone').value.trim();
        const email = $('inq_customer_email').value.trim();
        if (!phone && !email) { showToast('At least one contact method (phone or email) is required', 'warning'); return; }
        if (phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(phone)) { showToast('Invalid phone number format', 'warning'); return; }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Invalid email address format', 'warning'); return; }
    }
    if (_inqStep === 2) {
        const budget = $('inq_budget').value;
        const guests = $('inq_num_guests').value;
        if (budget && budget < 0) { showToast('Budget cannot be negative', 'warning'); return; }
        if (guests && guests < 1) { showToast('Number of guests must be at least 1', 'warning'); return; }
    }
    if (_inqStep < 4) _inqGoToStep(_inqStep + 1);
}

function inqPrev() {
    if (_inqStep > 1) _inqGoToStep(_inqStep - 1);
}

async function submitInquiry() {
    const body = {
        customer_name:    $('inq_customer_name').value.trim(),
        customer_phone:   $('inq_customer_phone').value.trim(),
        customer_email:   $('inq_customer_email').value.trim(),
        event_type:       $('inq_event_type').value,
        preferred_date:   $('inq_preferred_date').value,
        flexible_date:    $('inq_flexible_date').checked ? 1 : 0,
        num_guests:       $('inq_num_guests').value,
        preferred_room_id: $('inq_room_id').value || null,
        budget:           $('inq_budget').value,
        requirements:     $('inq_requirements').value.trim(),
        source:           $('inq_source').value,
        assigned_to:      $('inq_assigned_to').value.trim(),
        follow_up_date:   $('inq_follow_up_date').value,
        notes:            $('inq_notes').value.trim()
    };
    
    const menuData = getMenuSelections('inq');
    body.menu_selections = menuData.menu_selections;
    if (menuData.requiresApproval) {
        body.status = 'Pending'; // Override to pending if more than 3 per category
    }
    
    // Front-end Validations
    if (!body.customer_name) { showToast('Customer name is required', 'warning'); return; }
    if (!body.customer_phone && !body.customer_email) { showToast('At least one contact method is required', 'warning'); return; }
    if (body.customer_phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(body.customer_phone)) { showToast('Invalid phone format', 'warning'); return; }
    if (body.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email)) { showToast('Invalid email format', 'warning'); return; }
    if (body.budget && body.budget < 0) { showToast('Budget cannot be negative', 'warning'); return; }
    if (body.num_guests && body.num_guests < 1) { showToast('Guests must be at least 1', 'warning'); return; }

    try {
        if (_editingInquiryId) {
            await store.fetchAPI(`/inquiries/${_editingInquiryId}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Inquiry updated in database ✓', 'success');
        } else {
            await store.fetchAPI('/inquiries', { method: 'POST', body: JSON.stringify(body) });
            showToast('Inquiry saved to database ✓', 'success');
        }
        closeModal('inquiryModal');
        await store.refreshData();
    } catch(e) { showToast('Database error: ' + e.message, 'danger'); }
}

async function updateInquiryStatus(id, status) {
    try {
        await store.fetchAPI(`/inquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
        await store.refreshData();
        showToast(`Status updated to "${status}" ✓`, 'success');
    } catch(e) { showToast('Failed to update: ' + e.message, 'danger'); }
}

async function convertInquiry(id) {
    if (!confirm('Convert this inquiry to a Reservation? A new pending reservation will be created.')) return;
    try {
        const data = await store.fetchAPI(`/inquiries/${id}/convert`, { method: 'POST' }).then(r => r.json());
        await store.refreshData();
        showToast(`Converted! Reservation #${data.reservation_id} created ✓`, 'success');
    } catch(e) { showToast('Conversion failed: ' + e.message, 'danger'); }
}

async function deleteInquiry(id) {
    if (!confirm('Permanently delete this inquiry?')) return;
    try {
        await store.fetchAPI(`/inquiries/${id}`, { method: 'DELETE' });
        await store.refreshData();
        showToast('Inquiry deleted ✓', 'success');
    } catch(e) { showToast('Failed to delete: ' + e.message, 'danger'); }
}

function viewInquiryDetail(inqOrId) {
    const inq = (inqOrId && typeof inqOrId !== 'object') ? store.data.inquiries.find(i => i.id === inqOrId) : inqOrId;
    if (!inq) return;
    const sourceClass = (inq.source || 'Walk-in').replace(' ', '');
    $('inquiryDetailBody').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
            <div>
                <div class="inq-ref" style="margin-bottom:4px;">${inq.ref_no}</div>
                <h3 style="font-size:20px;font-weight:800;">${inq.customer_name}</h3>
                <div style="color:var(--text-muted);font-size:13px;margin-top:4px;">${inq.customer_phone || ''} ${inq.customer_email ? '· ' + inq.customer_email : ''}</div>
            </div>
            ${statusBadge(inq.status)}
        </div>

        <div class="detail-grid">
            <div class="detail-item"><label>Event Type</label><div class="detail-value">${inq.event_type || '—'}</div></div>
            <div class="detail-item"><label>Preferred Venue</label><div class="detail-value">${inq.room_name || '—'}</div></div>
            <div class="detail-item"><label>Preferred Date</label><div class="detail-value">${formatDate(inq.preferred_date)}${inq.flexible_date ? ' <span style="color:var(--primary);font-size:11px;">(Flexible)</span>' : ''}</div></div>
            <div class="detail-item"><label>No. of Guests</label><div class="detail-value">${inq.num_guests || '—'}</div></div>

            <div class="detail-item"><label>Source</label><div class="detail-value"><span class="source-badge source-${sourceClass}">${inq.source || '—'}</span></div></div>
            <div class="detail-item"><label>Assigned To</label><div class="detail-value">${inq.assigned_to || '—'}</div></div>
            <div class="detail-item"><label>Follow-up Date</label><div class="detail-value" style="${inq.follow_up_date && new Date(inq.follow_up_date) < new Date() ? 'color:#ef4444;' : ''}">${formatDate(inq.follow_up_date)}</div></div>
        </div>

        ${inq.requirements ? `
        <div style="margin-bottom:16px;">
            <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Requirements</label>
            <div style="margin-top:6px;padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;font-size:14px;line-height:1.6;">${inq.requirements}</div>
        </div>` : ''}

        ${inq.notes ? `
        <div style="margin-bottom:20px;">
            <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Internal Notes</label>
            <div style="margin-top:6px;padding:12px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);border-radius:10px;font-size:14px;line-height:1.6;">${inq.notes}</div>
        </div>` : ''}

        ${inq.menu_selections ? `
        <div style="margin-bottom:20px;">
            <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Menu Selection</label>
            <div style="margin-top:6px;padding:12px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:10px;font-size:13px;">
                ${Object.entries(typeof inq.menu_selections === 'string' ? JSON.parse(inq.menu_selections) : inq.menu_selections).map(([cat, items]) => 
                    `<strong style="color:var(--primary);">${cat}</strong> (${items.length}): <br>${items.map(i=>`• ${i}`).join('<br>')}<br><br>`
                ).join('')}
            </div>
        </div>` : ''}

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${inq.status !== 'Converted' ? `
            <button class="btn btn-primary btn-sm" onclick="closeModal('inquiryDetailModal'); convertInquiry(${inq.id})">
                <i class="fa-solid fa-arrow-right-arrow-left" style="margin-right:6px;"></i>Convert to Booking
            </button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="closeModal('inquiryDetailModal'); openInquiryModal(${inq.id})">
                <i class="fa-solid fa-pen" style="margin-right:6px;"></i>Edit
            </button>
            ${inq.status === 'New' ? `<button class="btn btn-outline btn-sm" onclick="updateInquiryStatus(${inq.id},'In Progress'); closeModal('inquiryDetailModal')">Mark In Progress</button>` : ''}
            ${inq.status === 'In Progress' ? `<button class="btn btn-outline btn-sm" onclick="updateInquiryStatus(${inq.id},'Quoted'); closeModal('inquiryDetailModal')">Mark Quoted</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="closeModal('inquiryDetailModal'); deleteInquiry(${inq.id})">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
    openModal('inquiryDetailModal');
}

// ─── Active filter state ──────────────────────────────────────────────────────
let _inquiryFilter = 'All';

function renderInquiry(c) {
    const all = store.data.inquiries;
    const statusCounts = { All: all.length, New: 0, 'In Progress': 0, Quoted: 0, Converted: 0, Rejected: 0 };
    all.forEach(i => { if (statusCounts[i.status] !== undefined) statusCounts[i.status]++; });

    const filtered = _inquiryFilter === 'All' ? all : all.filter(i => i.status === _inquiryFilter);

    const converted   = statusCounts.Converted;
    const convRate    = all.length ? Math.round(converted / all.length * 100) : 0;
    const overdue     = all.filter(i => i.follow_up_date && new Date(i.follow_up_date) < new Date() && i.status !== 'Converted' && i.status !== 'Rejected').length;

    const sourceIcons = { 'Walk-in': 'fa-person-walking', 'Phone Call': 'fa-phone', 'Email': 'fa-envelope', 'Social Media': 'fa-hashtag', 'Website': 'fa-globe', 'Referral': 'fa-people-arrows' };

    c.innerHTML = `
    <!-- Stats Row -->
    <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px;">
        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div class="stat-icon" style="background:rgba(0,242,254,0.15);"><i class="fa-solid fa-clipboard-list" style="color:#00f2fe;"></i></div>
            <div><div class="stat-value">${all.length}</div><div class="stat-label">Total Inquiries</div></div>
        </div>
        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div class="stat-icon" style="background:rgba(0,242,254,0.1);"><i class="fa-solid fa-envelope-open" style="color:#00f2fe;"></i></div>
            <div><div class="stat-value">${statusCounts.New}</div><div class="stat-label">New</div></div>
        </div>
        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div class="stat-icon" style="background:rgba(245,158,11,0.15);"><i class="fa-solid fa-spinner" style="color:#f59e0b;"></i></div>
            <div><div class="stat-value">${statusCounts['In Progress']}</div><div class="stat-label">In Progress</div></div>
        </div>
        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div class="stat-icon" style="background:rgba(16,185,129,0.15);"><i class="fa-solid fa-arrow-right-arrow-left" style="color:#10b981;"></i></div>
            <div><div class="stat-value">${converted}</div><div class="stat-label">Converted</div>
                <div class="conversion-bar" style="width:80px;"><div class="conversion-fill" style="width:${convRate}%;"></div></div>
                <div style="font-size:11px;color:var(--primary);margin-top:3px;">${convRate}% rate</div>
            </div>
        </div>
        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px;${overdue ? 'border-color:rgba(239,68,68,0.4);' : ''}">
            <div class="stat-icon" style="background:rgba(239,68,68,0.15);"><i class="fa-solid fa-bell" style="color:#ef4444;"></i></div>
            <div><div class="stat-value" style="${overdue ? 'color:#ef4444;' : ''}">${overdue}</div><div class="stat-label">Overdue Follow-ups</div></div>
        </div>
    </div>

    <div class="card">
        <!-- Header -->
        <div class="section-header" style="margin-bottom:20px;">
            <div>
                <h2><i class="fa-solid fa-clipboard-question" style="color:var(--primary);margin-right:10px;"></i>Inquiry Management</h2>
                <p>${filtered.length} of ${all.length} inquiries shown</p>
            </div>
            <button class="btn btn-primary" onclick="openInquiryModal()">
                <i class="fa-solid fa-plus" style="margin-right:8px;"></i>New Inquiry
            </button>
        </div>

        <!-- Filter Tabs -->
        <div class="filter-tabs" style="margin-bottom:24px;" id="inqFilterTabs">
            ${Object.entries(statusCounts).map(([status, count]) => `
                <button class="filter-tab ${_inquiryFilter === status ? 'active' : ''}"
                    onclick="_inquiryFilter='${status}'; navigate('/inquiry');">
                    ${status} <span style="font-size:11px;opacity:0.8;">(${count})</span>
                </button>
            `).join('')}
        </div>

        <!-- Inquiry Cards Grid -->
        ${filtered.length === 0 ? `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <h3>No Inquiries Found</h3>
                <p>No inquiries match the selected filter. Click "New Inquiry" to add one.</p>
            </div>` : `
        <div class="inq-kanban">
            ${filtered.map(inq => {
                const srcClass = (inq.source || 'Walk-in').replace(' ', '');
                const isOverdue = inq.follow_up_date && new Date(inq.follow_up_date) < new Date() && inq.status !== 'Converted' && inq.status !== 'Rejected';
                const statusClass = inq.status.replace(' ', '-');
                return `
                <div class="inq-card status-${statusClass}" onclick="viewInquiryDetail(${inq.id})">
                    <div class="inq-card-header">
                        <div>
                            <div class="inq-ref">${inq.ref_no || '—'}</div>
                        </div>
                        ${statusBadge(inq.status)}
                    </div>

                    <div class="inq-name">${inq.customer_name}</div>
                    <div class="inq-contact">
                        ${inq.customer_phone ? `<i class="fa-solid fa-phone" style="font-size:11px;margin-right:5px;color:var(--primary);"></i>${inq.customer_phone}` : ''}
                        ${inq.customer_email ? `<br><i class="fa-solid fa-envelope" style="font-size:11px;margin-right:5px;color:var(--primary);"></i>${inq.customer_email}` : ''}
                    </div>

                    <div class="inq-meta">
                        ${inq.event_type ? `<div class="inq-meta-item"><i class="fa-solid fa-champagne-glasses"></i>${inq.event_type}</div>` : ''}
                        ${inq.num_guests  ? `<div class="inq-meta-item"><i class="fa-solid fa-users"></i>${inq.num_guests} guests</div>` : ''}
                        ${inq.preferred_date ? `<div class="inq-meta-item"><i class="fa-regular fa-calendar"></i>${formatDate(inq.preferred_date)}${inq.flexible_date ? ' ±' : ''}</div>` : ''}

                        ${inq.room_name ? `<div class="inq-meta-item"><i class="fa-solid fa-door-open"></i>${inq.room_name}</div>` : ''}
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span class="source-badge source-${srcClass}"><i class="fa-solid ${sourceIcons[inq.source] || 'fa-circle-dot'}"></i>${inq.source || 'Walk-in'}</span>
                        ${inq.follow_up_date ? `<span style="font-size:11px;${isOverdue ? 'color:#ef4444;font-weight:700;' : 'color:var(--text-muted);'}">
                            <i class="fa-solid fa-bell" style="margin-right:4px;"></i>Follow-up: ${formatDate(inq.follow_up_date)}
                            ${isOverdue ? '<span style="background:rgba(239,68,68,0.2);padding:2px 6px;border-radius:6px;margin-left:4px;">OVERDUE</span>' : ''}
                        </span>` : ''}
                    </div>

                    ${inq.assigned_to ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;"><i class="fa-solid fa-user-tie" style="color:var(--primary);margin-right:5px;"></i>Assigned: ${inq.assigned_to}</div>` : ''}

                    <div class="inq-card-actions" onclick="event.stopPropagation();">
                        ${inq.status === 'New' ? `
                            <button class="btn btn-outline btn-sm" onclick="updateInquiryStatus(${inq.id},'In Progress')" title="Mark In Progress">
                                <i class="fa-solid fa-play"></i>
                            </button>` : ''}
                        ${inq.status === 'In Progress' ? `
                            <button class="btn btn-outline btn-sm" onclick="updateInquiryStatus(${inq.id},'Quoted')" title="Mark Quoted" style="border-color:#8b5cf6;color:#8b5cf6;">
                                <i class="fa-solid fa-file-invoice-dollar"></i>
                            </button>` : ''}
                        ${inq.status !== 'Converted' && inq.status !== 'Rejected' ? `
                            <button class="btn btn-primary btn-sm" onclick="convertInquiry(${inq.id})" title="Convert to Booking" style="flex:1;justify-content:center;">
                                <i class="fa-solid fa-arrow-right-arrow-left" style="margin-right:6px;"></i>Convert
                            </button>` : ''}
                        <button class="btn btn-outline btn-sm" onclick="openInquiryModal(${inq.id})" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteInquiry(${inq.id})" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            }).join('')}
        </div>`}
    </div>

    <!-- Source Breakdown -->
    <div class="card" style="margin-top:24px;">
        <h3 style="margin-bottom:20px;"><i class="fa-solid fa-chart-pie" style="color:var(--primary);margin-right:10px;"></i>Inquiry Sources</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;">
            ${Object.entries(
                all.reduce((acc, i) => { const s = i.source||'Walk-in'; acc[s] = (acc[s]||0)+1; return acc; }, {})
            ).sort((a,b) => b[1]-a[1]).map(([src, cnt]) => {
                const srcClass = src.replace(' ', '');
                const icon = sourceIcons[src] || 'fa-circle-dot';
                return `<div style="text-align:center;padding:16px;border:1px solid var(--glass-border);border-radius:16px;">
                    <i class="fa-solid ${icon}" style="font-size:24px;margin-bottom:8px;display:block;color:var(--primary);"></i>
                    <div style="font-size:22px;font-weight:800;">${cnt}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${src}</div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}


function checkOverlap(roomId, dateStart, dateEnd, excludeResId = null) {
    if (!roomId || !dateStart) return false;
    const start = new Date(dateStart);
    const end = dateEnd ? new Date(dateEnd) : start;
    
    return store.data.reservations.some(r => {
        if (r.room_id != roomId) return false;
        if (r.status !== 'Confirmed') return false;
        if (excludeResId && r.id == excludeResId) return false;
        
        const rStart = new Date(r.date_start);
        const rEnd = r.date_end ? new Date(r.date_end) : rStart;
        
        return start <= rEnd && end >= rStart;
    });
}

// ─── Payments & Invoices View ────────────────────────────────────────────────
function renderPayments(c) {
    const completedReservations = store.data.reservations.filter(r => r.status === 'Completed' || r.status === 'Checked Out');
    
    c.innerHTML = `
    <div class="header">
        <div class="header-title">
            <h1 class="page-title"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--primary);margin-right:10px;"></i>Payments & Invoices</h1>
            <p style="color:var(--text-muted);font-size:14px;margin-top:5px;">Ledger of all completed and paid reservations.</p>
        </div>
    </div>
    
    <div class="card" style="margin-top:20px;">
        ${completedReservations.length === 0 ? `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <h3>No Completed Invoices</h3>
                <p>There are no checked-out reservations yet.</p>
            </div>
        ` : `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Invoice / Booking No</th>
                            <th>Customer</th>
                            <th>Event / Venue</th>
                            <th>Date Completed</th>
                            <th>Total Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${completedReservations.sort((a,b) => b.id - a.id).map(r => `
                            <tr>
                                <td style="font-weight:700; color:var(--primary);">${r.booking_no || 'BKG-'+String(r.id).padStart(4,'0')}</td>
                                <td>
                                    <div style="font-weight:600;">${r.customer_name}</div>
                                    <div style="font-size:12px;color:var(--text-muted);">${r.customer_phone || ''}</div>
                                </td>
                                <td>${r.event_name} <br><span style="font-size:11px;color:var(--text-muted);">${r.room_name || ''}</span></td>
                                <td style="font-size:13px;color:var(--text-muted);">${new Date(r.date_end || r.updated_at || r.created_at || Date.now()).toLocaleDateString()}</td>
                                <td style="color:var(--primary);font-weight:700;">${formatCurrency(parseFloat(r.total_price || 0) + parseFloat(r.pos_charges || 0))} <span style="font-size:10px; color:#666;">(Includes POS charges)</span></td>
                                <td><span style="background:rgba(16, 185, 129, 0.1); color:#10b981; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>PAID</span></td>
                                <td>
                                    <button class="btn btn-outline btn-sm" onclick="checkoutReservation(${r.id})" title="View Invoice" style="border-color:#10b981;color:#10b981;">
                                        <i class="fa-solid fa-eye" style="margin-right:6px;"></i>View Invoice
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `}
    </div>
    `;
}

async function deleteWaitlistEntry(id) {
    if (!confirm('Remove this customer from the waitlist queue?')) return;
    try {
        await store.fetchAPI(`/waitlist/${id}`, { method: 'DELETE' });
        await store.refreshData();
        showToast('Waitlist entry removed ✓', 'success');
    } catch (err) {
        showToast('Failed to remove waitlist entry: ' + err.message, 'danger');
    }
}

async function updateReservationStatus(id, status) {
    try {
        const response = await store.fetchAPI(`/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }).then(r => r.json());
        await store.refreshData();
        showToast(`Reservation ${status} — database updated ✓`, 'success');
        if (response.promoted) {
            setTimeout(() => {
                alert(`🎉 WAITLIST PROMOTION:\n\nCustomer "${response.promoted.customer_name}" has been automatically promoted to a Pending booking for Room/Venue!`);
            }, 500);
        }
    } catch(e) { showToast('Failed to update status: ' + e.message, 'danger'); }
}

let _currentCheckoutId = null;

async function checkoutReservation(id) {
    const res = store.data.reservations.find(r => r.id === id);
    if (!res) return showToast('Reservation not found', 'error');
    
    _currentCheckoutId = id;
    
    $('chk_customer_name').textContent = res.customer_name;
    $('chk_event_name').textContent = res.event_name;
    $('chk_booking_no').textContent = res.booking_no || ('BKG-' + String(id).padStart(4, '0'));
    $('chk_date').textContent = new Date().toLocaleDateString();
    
    if (res.status === 'Completed') {
        $('chk_status').textContent = 'PAID';
        $('chk_status').style.color = '#10b981';
        $('markPaidCheckoutBtn').style.display = 'none';
    } else {
        $('chk_status').textContent = 'UNPAID';
        $('chk_status').style.color = '#ef4444';
        $('markPaidCheckoutBtn').style.display = 'flex';
        $('markPaidCheckoutBtn').onclick = () => finalizeCheckout(id);
    }

    let subtotal = 0;
    let itemsHtml = '';

    // 1. Add Room/Event Charge
    if (res.total_price) {
        subtotal += parseFloat(res.total_price);
        itemsHtml += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px;"><strong>Event/Room Charge:</strong> Venue Booking</td>
                <td style="padding:12px; text-align:right;">${sym()}${parseFloat(res.total_price).toFixed(2)}</td>
            </tr>
        `;
    }

    // 2. Fetch Restaurant Orders
    try {
        const ordersRes = await fetch(`/api/reservations/${id}/orders`);
        const orders = await ordersRes.json();
        
        if (orders && orders.length > 0) {
            orders.forEach(o => {
                subtotal += parseFloat(o.total);
                itemsHtml += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:12px;">
                            <strong>Restaurant Order #${o.id}</strong>
                            <div style="font-size:12px; color:#666;">${o.items ? o.items.map(i => i.qty + 'x ' + i.dish_name).join(', ') : ''}</div>
                        </td>
                        <td style="padding:12px; text-align:right;">${sym()}${parseFloat(o.total).toFixed(2)}</td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error('Error fetching orders for checkout', err);
    }

    $('chk_items_body').innerHTML = itemsHtml;
    
    const tax = 0; // Tax is assumed included or calculate if needed
    const grandTotal = subtotal + tax;

    $('chk_subtotal').textContent = `${sym()}${subtotal.toFixed(2)}`;
    $('chk_tax').textContent = `${sym()}${tax.toFixed(2)}`;
    $('chk_grand_total').textContent = `${sym()}${grandTotal.toFixed(2)}`;

    openModal('checkoutModal');
}

async function finalizeCheckout(id) {
    if (!confirm('Are you sure you want to mark this reservation as Paid and Checkout?')) return;
    
    try {
        await store.fetchAPI(`/reservations/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Completed' })
        });
        showToast('Reservation Checked Out & Marked as Paid', 'success');
        $('chk_status').textContent = 'PAID';
        $('chk_status').style.color = '#10b981';
        $('markPaidCheckoutBtn').style.display = 'none';
        
        await store.refreshData();
        renderBooking($('content')); // refresh UI
    } catch (err) {
        showToast('Error finalizing checkout', 'error');
    }
}

function printCheckoutInvoice() {
    const printContent = document.getElementById('checkoutPrintArea').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    
    // reattach events
    window.location.reload();
}

async function deleteReservation(id) {
    if (!confirm('Permanently delete this reservation?')) return;
    try {
        const response = await store.fetchAPI(`/reservations/${id}`, { method: 'DELETE' }).then(r => r.json());
        await store.refreshData();
        showToast('Reservation deleted from database ✓', 'success');
        if (response.promoted) {
            setTimeout(() => {
                alert(`🎉 WAITLIST PROMOTION:\n\nCustomer "${response.promoted.customer_name}" has been automatically promoted to a Pending booking for Room/Venue!`);
            }, 500);
        }
    } catch(e) { showToast('Failed to delete: ' + e.message, 'danger'); }
}


// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
let _editingCustomerId = null;

function switchCustTab(type) {
    $('custTabPersonal').classList.remove('active');
    $('custTabCompany').classList.remove('active');
    $('custTab' + type).classList.add('active');
    
    $('cust_type').value = type;
    
    if (type === 'Company') {
        $('lbl_cust_name').innerText = 'Company Name';
        $('lbl_cust_phone').innerText = 'Company Phone';
        $('lbl_cust_email').innerText = 'Company Email';
        $('company_fields_wrapper').style.display = 'block';
    } else {
        $('lbl_cust_name').innerText = 'Full Name';
        $('lbl_cust_phone').innerText = 'Phone Number';
        $('lbl_cust_email').innerText = 'Email Address';
        $('company_fields_wrapper').style.display = 'none';
    }
}

function openCustomerModal(customerOrId = null) {
    const customer = (customerOrId && typeof customerOrId !== 'object') ? store.data.customers.find(c => c.id === customerOrId) : customerOrId;
    _editingCustomerId = customer ? customer.id : null;
    $('cust_name').value  = customer ? customer.name  : '';
    $('cust_phone').value = customer ? customer.phone : '';
    $('cust_email').value = customer ? customer.email : '';
    $('cust_contact_person').value = customer && customer.contact_person ? customer.contact_person : '';
    $('cust_contact_phone').value = customer && customer.contact_person_phone ? customer.contact_person_phone : '';
    
    switchCustTab(customer && customer.customer_type ? customer.customer_type : 'Personal');
    
    $('customerModal').querySelector('h3').innerHTML =
        `<i class="fa-solid fa-user-plus" style="color:var(--primary);margin-right:10px;"></i>${_editingCustomerId ? 'Edit Customer' : 'Register Customer'}`;
    openModal('customerModal');
}

async function submitCustomer() {
    const body = {
        name:  $('cust_name').value.trim(),
        phone: $('cust_phone').value.trim(),
        email: $('cust_email').value.trim(),
        customer_type: $('cust_type').value,
        contact_person: $('cust_contact_person').value.trim(),
        contact_person_phone: $('cust_contact_phone').value.trim()
    };
    
    if (!body.name) { showToast('Customer name is required', 'warning'); return; }
    if (!body.phone) { showToast('Phone number is required', 'warning'); return; }
    if (body.phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(body.phone)) { showToast('Invalid phone number format', 'warning'); return; }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) { showToast('Invalid email format', 'warning'); return; }

    try {
        if (_editingCustomerId) {
            await store.fetchAPI(`/customers/${_editingCustomerId}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Customer updated in database ✓', 'success');
        } else {
            await store.fetchAPI('/customers', { method: 'POST', body: JSON.stringify(body) });
            showToast('Customer registered in database ✓', 'success');
        }
        closeModal('customerModal');
        await store.refreshData();
    } catch(e) { showToast('Database error: ' + e.message, 'danger'); }
}

async function deleteCustomer(id) {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
        await store.fetchAPI(`/customers/${id}`, { method: 'DELETE' });
        await store.refreshData();
        showToast('Customer deleted from database ✓', 'success');
    } catch(e) { showToast('Failed to delete: ' + e.message, 'danger'); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
let _editingRoomId = null;

function openRoomModal(roomOrId = null) {
    const room = (roomOrId && typeof roomOrId !== 'object') ? store.data.eventRooms.find(r => r.id === roomOrId) : roomOrId;
    _editingRoomId = room ? room.id : null;
    $('room_name').value     = room ? room.name          : '';
    $('room_capacity').value = room ? room.capacity      : '';
    $('room_price').value    = room ? room.price_per_day : '';
    $('room_type').value     = room ? room.type          : 'Banquet';
    $('room_status').value   = room ? room.status        : 'Available';
    $('roomModal').querySelector('h3').innerHTML =
        `<i class="fa-solid fa-door-open" style="color:var(--primary);margin-right:10px;"></i>${_editingRoomId ? 'Edit Venue' : 'Add Venue'}`;
    openModal('roomModal');
}

async function submitRoom() {
    const body = {
        name:          $('room_name').value.trim(),
        capacity:      parseInt($('room_capacity').value),
        price_per_day: parseFloat($('room_price').value),
        type:          $('room_type').value,
        status:        $('room_status').value
    };
    
    if (!body.name) { showToast('Venue name is required', 'warning'); return; }
    if (isNaN(body.capacity) || body.capacity < 1) { showToast('Capacity must be a valid number > 0', 'warning'); return; }
    if (isNaN(body.price_per_day) || body.price_per_day < 0) { showToast('Price must be a valid positive number', 'warning'); return; }

    try {
        if (_editingRoomId) {
            await store.fetchAPI(`/event-rooms/${_editingRoomId}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Venue updated in database ✓', 'success');
        } else {
            await store.fetchAPI('/event-rooms', { method: 'POST', body: JSON.stringify(body) });
            showToast('Venue saved to database ✓', 'success');
        }
        closeModal('roomModal');
        await store.refreshData();
    } catch(e) { showToast('Database error: ' + e.message, 'danger'); }
}

async function deleteRoom(id) {
    if (!confirm('Delete this venue?')) return;
    try {
        await store.fetchAPI(`/event-rooms/${id}`, { method: 'DELETE' });
        await store.refreshData();
        showToast('Venue deleted from database ✓', 'success');
    } catch(e) { showToast('Failed to delete: ' + e.message, 'danger'); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM CALENDAR (TIMELINE) MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function openRoomCalendar(roomId) {
    const room = store.data.eventRooms.find(r => r.id === roomId);
    if (!room) return;

    $('roomCalendarTitleText').innerText = `${room.name} — Availability Timeline`;

    const now = new Date();
    // Get active reservations for this room, starting from today or future
    const bookings = store.data.reservations.filter(r => 
        r.room_id == roomId && 
        r.status !== 'Cancelled' && 
        (new Date(r.date_end || r.date_start) >= new Date(now.setHours(0,0,0,0)))
    ).sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    const content = $('roomCalendarContent');
    
    if (bookings.length === 0) {
        content.innerHTML = `
            <div class="empty-state" style="padding:40px 20px;">
                <i class="fa-solid fa-calendar-check" style="color:#10b981; font-size:48px; margin-bottom:15px; opacity:1;"></i>
                <h3 style="margin-bottom:8px;">Fully Available!</h3>
                <p style="color:var(--text-muted); font-size:14px;">There are no upcoming bookings for this venue.</p>
            </div>
        `;
    } else {
        content.innerHTML = bookings.map(b => {
            const start = new Date(b.date_start);
            const end = b.date_end ? new Date(b.date_end) : start;
            const isToday = start.toDateString() === new Date().toDateString();
            const dateStr = start.getTime() === end.getTime() 
                ? formatDate(b.date_start) 
                : `${formatDate(b.date_start)} — ${formatDate(b.date_end)}`;
            
            return `
            <div style="background:rgba(255,255,255,0.03); border-left:4px solid ${b.status === 'Confirmed' ? '#10b981' : '#f59e0b'}; border-radius:6px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:12px; color:var(--primary); font-weight:700; margin-bottom:4px;">${dateStr} ${isToday ? '<span class="badge badge-warning" style="margin-left:8px; font-size:9px;">TODAY</span>' : ''}</div>
                    <div style="font-weight:700; font-size:15px;">${b.event_name}</div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
                        <i class="fa-solid fa-user" style="margin-right:5px;"></i>${b.customer_name} 
                        <span style="margin:0 8px;">•</span> 
                        <i class="fa-solid fa-users" style="margin-right:5px;"></i>${b.num_guests || 0} guests
                    </div>
                </div>
                <div>
                    ${statusBadge(b.status)}
                </div>
            </div>
            `;
        }).join('');
    }

    openModal('roomCalendarModal');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING INLINE FORM
// ═══════════════════════════════════════════════════════════════════════════════
async function submitBookingForm() {
    const body = {
        booking_no:     $('bk_booking_no').value.trim(),
        inquiry_ref_no: $('bk_inquiry_ref_no').value || null,
        event_name:     $('bk_event_name').value.trim(),
        customer_name:  $('bk_customer_name').value.trim(),
        customer_phone: $('bk_customer_phone').value.trim(),
        room_id:        $('bk_room_id').value || null,
        date_start:     $('bk_date_start').value,
        date_end:       $('bk_date_end').value,
        num_guests:     $('bk_num_guests').value,
        status:         $('bk_status').value,
        total_price:    $('bk_total_price').value,
        notes:          $('bk_notes').value.trim()
    };
    
    // Front-end Validations
    if (!body.event_name) { showToast('Event name is required', 'warning'); return; }
    if (!body.customer_name) { showToast('Customer name is required', 'warning'); return; }
    if (!body.customer_phone) { showToast('Customer phone is required', 'warning'); return; }
    if (body.customer_phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(body.customer_phone)) { showToast('Invalid phone number format', 'warning'); return; }
    if (!body.date_start) { showToast('Start date is required', 'warning'); return; }
    if (body.date_end && new Date(body.date_start) > new Date(body.date_end)) { showToast('End date cannot be before start date', 'warning'); return; }
    if (body.num_guests && body.num_guests < 1) { showToast('Number of guests must be at least 1', 'warning'); return; }
    if (body.total_price && body.total_price < 0) { showToast('Total price cannot be negative', 'warning'); return; }

    const overlaps = checkOverlap(body.room_id, body.date_start, body.date_end);
    if (overlaps && body.status === 'Confirmed') {
        if (confirm('⚠️ VENUE OVERLAP CONFLICT!\n\nThis room/venue is already booked for the selected dates. Would you like to add the customer to the Waitlist queue instead?')) {
            try {
                await store.fetchAPI('/waitlist', {
                    method: 'POST',
                    body: JSON.stringify({
                        room_id: body.room_id,
                        customer_name: body.customer_name,
                        customer_phone: body.customer_phone,
                        date_start: body.date_start,
                        date_end: body.date_end,
                        num_guests: body.num_guests,
                        event_name: body.event_name,
                        notes: body.notes || ''
                    })
                });
                await store.refreshData();
                showToast('Customer added to the Waitlist queue ✓', 'success');
                clearBookingForm();
            } catch (err) {
                showToast('Failed to add to Waitlist: ' + err.message, 'danger');
            }
        }
        return;
    }

    try {
        await store.fetchAPI('/reservations', { method: 'POST', body: JSON.stringify(body) });
        await store.refreshData();
        showToast('Booking saved to database ✓', 'success');
        clearBookingForm();
    } catch(e) { showToast('Database error: ' + e.message, 'danger'); }
}

function clearBookingForm() {
    ['bk_booking_no', 'bk_inquiry_ref_no', 'bk_event_name','bk_customer_name','bk_customer_phone','bk_date_start','bk_date_end','bk_num_guests','bk_total_price','bk_notes']
        .forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('bk_booking_no')) $('bk_booking_no').value = generateLocalBookingNo();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED TABLE RENDERER
// ═══════════════════════════════════════════════════════════════════════════════
function reservationTable(reservations, opts = {}) {
    if (!reservations.length) return `
        <div class="empty-state">
            <i class="fa-regular fa-calendar-xmark"></i>
            <h3>No Records Found</h3>
            <p>Nothing in the database yet.</p>
        </div>`;
    return `
    <div class="table-wrapper">
        <table class="data-table">
            <thead><tr>
                <th>Event</th><th>Customer</th><th>Venue</th>
                <th>Guests</th><th>From</th><th>To</th>
                <th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
             ${reservations.map(r => `
                <tr>
                    <td style="vertical-align:top;">
                        <div style="font-size:12px;color:var(--primary);font-weight:700;">${r.booking_no || 'BKG-'+String(r.id).padStart(4,'0')}</div>
                        <div style="font-weight:700;">${r.event_name}</div>
                        ${r.inquiry_ref_no ? `<div style="font-size:11px;color:var(--text-muted);"><i class="fa-solid fa-clipboard-question"></i> Ref: ${r.inquiry_ref_no}</div>` : ''}
                        ${r.menu_selections && !opts.hideMenu ? `
                        <div style="margin-top:8px;padding:8px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.05);border-radius:6px;font-size:11px;line-height:1.4;">
                            <strong style="color:var(--primary);display:block;margin-bottom:4px;">Menu Selection:</strong>
                            ${Object.entries(typeof r.menu_selections === 'string' ? JSON.parse(r.menu_selections) : r.menu_selections).map(([cat, items]) => 
                                `<div style="margin-bottom:3px;"><span style="color:#a8b2d1;font-weight:600;">${cat}:</span> ${items.join(', ')}</div>`
                            ).join('')}
                        </div>` : ''}
                    </td>
                    <td>
                        <div style="font-weight:600;">${r.customer_name}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${r.customer_phone || ''}</div>
                    </td>
                    <td style="color:var(--text-muted);">${r.room_name || '—'}</td>
                    <td>${r.num_guests || '—'}</td>
                    <td style="font-size:13px;color:var(--text-muted);">${formatDate(r.date_start)}</td>
                    <td style="font-size:13px;color:var(--text-muted);">${formatDate(r.date_end)}</td>
                    <td>
                        ${statusBadge(r.status)}
                        ${(r.status === 'Confirmed' && r.date_start && (new Date(r.date_start) - new Date()) / (1000 * 60 * 60 * 24) <= 4 && (new Date(r.date_start) - new Date()) > 0) ? '<div style="color:#ef4444;font-size:11px;font-weight:700;margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Full Payment Due</div>' : ''}
                    </td>
                    <td>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${r.status === 'Draft' ? `
                                <button class="btn btn-primary btn-sm" onclick="updateReservationStatus(${r.id}, 'Pending Finance')" title="Send to Finance for Advance Payment" style="background:#f59e0b;color:#000;">
                                    <i class="fa-solid fa-paper-plane"></i> Send to Finance
                                </button>` : ''}
                            ${opts.showConfirm && r.status === 'Pending' ? `
                                <button class="btn btn-primary btn-sm" onclick="updateReservationStatus(${r.id},'Confirmed')">
                                    <i class="fa-solid fa-check"></i>
                                </button>` : ''}
                            ${opts.showReject && r.status === 'Pending' ? `
                                <button class="btn btn-danger btn-sm" onclick="updateReservationStatus(${r.id},'Cancelled')">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>` : ''}
                            ${(r.status === 'Confirmed' || r.status === 'Checked In' || r.status === 'Completed') ? `
                                <button class="btn btn-outline btn-sm" onclick="printAgreement(${r.id})" title="Print Agreement" style="border-color:#10b981;color:#10b981;">
                                    <i class="fa-solid fa-file-contract"></i>
                                </button>` : ''}
                            ${r.payment_slip ? `
                                <button class="btn btn-outline btn-sm" onclick="viewSlip(${r.id})" title="View Payment Slip" style="border-color:#3b82f6;color:#3b82f6;">
                                    <i class="fa-solid fa-file-invoice"></i>
                                </button>` : ''}
                            <button class="btn btn-outline btn-sm" onclick="openReservationModal(${r.id})" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteReservation(${r.id})" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('')}
            </tbody>
        </table>
    </div>`;
}

function eventMenuTable(reservations) {
    if (!reservations.length) return `
        <div class="empty-state">
            <i class="fa-solid fa-utensils"></i>
            <h3>No Records Found</h3>
            <p>No events with menu selections yet.</p>
        </div>`;
    return `
    <div class="table-wrapper">
        <table class="data-table">
            <thead><tr>
                <th>Event Details</th>
                <th>Menu Selections</th>
                <th>Actions</th>
            </tr></thead>
            <tbody>
             ${reservations.map(r => `
                <tr>
                    <td style="vertical-align:top; width:250px;">
                        <div style="font-size:12px;color:var(--primary);font-weight:700;">${r.booking_no || 'BKG-'+String(r.id).padStart(4,'0')}</div>
                        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${r.event_name}</div>
                        <div style="font-size:13px;"><i class="fa-solid fa-user" style="color:var(--text-muted);margin-right:5px;"></i>${r.customer_name}</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;"><i class="fa-solid fa-calendar" style="margin-right:5px;"></i>${formatDate(r.date_start)}</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;"><i class="fa-solid fa-users" style="margin-right:5px;"></i>${r.num_guests || '0'} guests</div>
                        <div style="margin-top:8px;">${statusBadge(r.status)}</div>
                    </td>
                    <td style="vertical-align:top;">
                        ${r.menu_selections ? `
                        <div style="padding:12px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:13px;line-height:1.5;display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;">
                            ${Object.entries(typeof r.menu_selections === 'string' ? JSON.parse(r.menu_selections) : r.menu_selections).map(([cat, items]) => 
                                `<div><strong style="color:var(--primary);display:block;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:2px;">${cat}</strong>${items.map(i=>`<div style="color:#d1d5db;margin-bottom:2px;">• ${i}</div>`).join('')}</div>`
                            ).join('')}
                        </div>` : `<div style="color:var(--text-muted);font-size:13px;font-style:italic;">No menu items selected for this event.</div>`}
                    </td>
                    <td style="vertical-align:top; width:120px;">
                        <button class="btn btn-outline btn-sm" onclick="openReservationModal(${r.id})" title="Edit Menu" style="width:100%;justify-content:center;">
                            <i class="fa-solid fa-pen" style="margin-right:6px;"></i> Update
                        </button>
                    </td>
                </tr>
            `).join('')}
            </tbody>
        </table>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

function renderDashboard(c) {
    const { reservations, customers, eventRooms } = store.data;
    const revenue   = reservations.reduce((a, r) => a + parseFloat(r.total_price || 0), 0);
    const confirmed = reservations.filter(r => r.status === 'Confirmed').length;
    const pending   = reservations.filter(r => r.status === 'Pending').length;
    const upcoming  = reservations.filter(r => new Date(r.date_start) >= new Date()).length;
    const available = eventRooms.filter(r => r.status === 'Available').length;

    c.innerHTML = `
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon" style="background:rgba(0,242,254,0.15);">
                <i class="fa-solid fa-calendar-check" style="color:#00f2fe;"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value">${reservations.length}</div>
                <div class="stat-label">Total Reservations</div>
                <div class="stat-trend positive"><i class="fa-solid fa-circle-dot" style="margin-right:4px;"></i>${confirmed} Confirmed · ${pending} Pending</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background:rgba(16,185,129,0.15);">
                <i class="fa-solid fa-users" style="color:#10b981;"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value">${customers.length}</div>
                <div class="stat-label">Registered Customers</div>
                <div class="stat-trend positive"><i class="fa-solid fa-circle-dot" style="margin-right:4px;"></i>Synced from DB</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background:rgba(79,172,254,0.15);">
                <i class="fa-solid fa-door-open" style="color:#4facfe;"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value">${eventRooms.length}</div>
                <div class="stat-label">Venues</div>
                <div class="stat-trend positive"><i class="fa-solid fa-circle-dot" style="margin-right:4px;"></i>${available} Available</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background:rgba(245,158,11,0.15);">
                <i class="fa-solid fa-sack-dollar" style="color:#f59e0b;"></i>
            </div>
            <div class="stat-info">
                <div class="stat-value" style="font-size:20px;">${formatCurrency(revenue)}</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-trend positive"><i class="fa-solid fa-arrow-trend-up" style="margin-right:4px;"></i>${upcoming} upcoming</div>
            </div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="card">
            <div class="section-header">
                <div><h2>Recent Reservations</h2><p>Latest bookings from database</p></div>
                <button class="btn btn-primary btn-sm" onclick="openReservationModal()">
                    <i class="fa-solid fa-plus" style="margin-right:6px;"></i>New
                </button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Event</th><th>Customer</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                        ${reservations.length === 0 ? `<tr><td colspan="4"><div class="empty-state" style="padding:20px;"><i class="fa-regular fa-calendar-xmark"></i><p>No reservations yet</p></div></td></tr>` : ''}
                        ${reservations.slice(0,6).map(r => `
                            <tr>
                                <td style="font-weight:700;">${r.event_name}</td>
                                <td style="color:var(--text-muted);">${r.customer_name}</td>
                                <td style="color:var(--text-muted);font-size:13px;">${formatDate(r.date_start)}</td>
                                <td>${statusBadge(r.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <div class="section-header">
                <div><h2>Venues</h2><p>${available} available now</p></div>
                <button class="btn btn-outline btn-sm" onclick="openRoomModal()">
                    <i class="fa-solid fa-plus" style="margin-right:6px;"></i>Add
                </button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Venue</th><th>Type</th><th>Price/Day</th><th>Status</th></tr></thead>
                    <tbody>
                        ${eventRooms.length === 0 ? `<tr><td colspan="4"><div class="empty-state" style="padding:20px;"><i class="fa-solid fa-door-closed"></i><p>No venues yet</p></div></td></tr>` : ''}
                        ${eventRooms.map(r => `
                            <tr>
                                <td style="font-weight:700;">${r.name}</td>
                                <td style="color:var(--text-muted);">${r.type}</td>
                                <td style="color:var(--primary);font-weight:700;">${formatCurrency(r.price_per_day)}</td>
                                <td>${statusBadge(r.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

let _currentCustomerListTab = 'Personal';

function renderCustomers(c) {
    const drawView = () => {
        const { customers } = store.data;
        const filteredCustomers = customers.filter(cu => (cu.customer_type || 'Personal') === _currentCustomerListTab);

        c.innerHTML = `
        <div class="card">
            <div class="section-header">
                <div>
                    <h2><i class="fa-solid fa-user-plus" style="color:var(--primary);margin-right:10px;"></i>Customer Registration</h2>
                    <p>${filteredCustomers.length} ${_currentCustomerListTab} customers synced from database</p>
                </div>
                <button class="btn btn-primary" onclick="openCustomerModal()">
                    <i class="fa-solid fa-plus" style="margin-right:8px;"></i>Register Customer
                </button>
            </div>
            
            <div class="modal-tabs" style="display:flex; gap:10px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:20px; padding: 0 20px;">
                <button type="button" class="filter-tab ${_currentCustomerListTab === 'Personal' ? 'active' : ''}" data-tab="Personal" style="flex:1; margin-bottom:-1px; border-bottom-left-radius:0; border-bottom-right-radius:0; border:1px solid transparent;">Personal</button>
                <button type="button" class="filter-tab ${_currentCustomerListTab === 'Company' ? 'active' : ''}" data-tab="Company" style="flex:1; margin-bottom:-1px; border-bottom-left-radius:0; border-bottom-right-radius:0; border:1px solid transparent;">Company</button>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    ${_currentCustomerListTab === 'Company' ? `
                    <thead><tr><th>#</th><th>Company Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Loyalty</th><th>Actions</th></tr></thead>
                    ` : `
                    <thead><tr><th>#</th><th>Full Name</th><th>Phone</th><th>Email</th><th>Loyalty</th><th>Actions</th></tr></thead>
                    `}
                    <tbody>
                        ${filteredCustomers.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-users"></i><h3>No ${_currentCustomerListTab} Customers</h3><p>Register your first customer to get started</p></div></td></tr>` : ''}
                        ${filteredCustomers.map((cu, i) => `
                            <tr>
                                <td style="color:var(--text-muted);font-size:12px;">${String(i+1).padStart(2,'0')}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:10px;">
                                        <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--primary);font-size:14px;">${(cu.name||'?')[0].toUpperCase()}</div>
                                        <span style="font-weight:700;">${cu.name}</span>
                                    </div>
                                </td>
                                ${_currentCustomerListTab === 'Company' ? `
                                <td style="color:var(--text-muted);">${cu.contact_person ? cu.contact_person + '<br><small>' + (cu.contact_person_phone || '') + '</small>' : '—'}</td>
                                ` : ''}
                                <td style="color:var(--text-muted);">${cu.phone || '—'}</td>
                                <td style="color:var(--text-muted);">${cu.email || '—'}</td>
                                <td><span class="badge badge-info">${cu.loyalty_points || 0} pts</span></td>
                                <td>
                                    <div style="display:flex;gap:6px;">
                                        <button class="btn btn-outline btn-sm" onclick="openCustomerModal(${cu.id})">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${cu.id})">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

        c.querySelectorAll('.filter-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                _currentCustomerListTab = e.currentTarget.getAttribute('data-tab');
                drawView();
            });
        });
    };

    drawView();
}


function renderBooking(c) {
    const roomOpts = store.data.eventRooms
        .map(r => `<option value="${r.id}">${r.name} — ${formatCurrency(r.price_per_day)}/day (Cap: ${r.capacity})</option>`)
        .join('');

    const inqOpts = `<option value="">-- Select Inquiry (Optional) --</option>` +
        store.data.inquiries.map(inq => `<option value="${inq.ref_no}">${inq.ref_no} — ${inq.customer_name} (${inq.event_type})</option>`).join('');

    const waitlist = store.data.waitlist || [];

    c.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
        <div class="section-header">
            <div>
                <h2><i class="fa-solid fa-calendar-plus" style="color:var(--primary);margin-right:10px;"></i>Create Booking</h2>
                <p>All entries are saved directly to the database</p>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px;">
            <div class="form-group">
                <label>Booking No</label>
                <input id="bk_booking_no" type="text" readonly style="background:rgba(255,255,255,0.05); cursor:not-allowed;" placeholder="Auto-generated">
            </div>
            <div class="form-group">
                <label>Inquiry No (Populate Details)</label>
                <select id="bk_inquiry_ref_no">${inqOpts}</select>
            </div>
            <div class="form-group"><label>Event Name *</label><input id="bk_event_name" type="text" placeholder="e.g. Wedding Reception"></div>
            <div class="form-group"><label>Venue</label><select id="bk_room_id"><option value="">-- No Venue --</option>${roomOpts}</select></div>
            <div class="form-group"><label>Customer Name *</label><input id="bk_customer_name" type="text" placeholder="Full name"></div>
            <div class="form-group"><label>Phone</label><input id="bk_customer_phone" type="text" placeholder="+94 77 ..."></div>
            <div class="form-group"><label>From Date *</label><input id="bk_date_start" type="date"></div>
            <div class="form-group"><label>To Date</label><input id="bk_date_end" type="date"></div>
            <div class="form-group"><label>No. of Guests</label><input id="bk_num_guests" type="number" placeholder="100" min="1"></div>
            <div class="form-group"><label>Total Price (${sym()})</label><input id="bk_total_price" type="number" placeholder="0.00"></div>
            <div class="form-group"><label>Status</label>
                <select id="bk_status">
                    <option value="Draft">Draft</option>
                    <option value="Pending Finance" selected>Pending Finance</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Closed">Closed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
            </div>
        </div>
        <div class="form-group"><label>Notes</label><textarea id="bk_notes" rows="2" placeholder="Any special requirements..." style="resize:vertical;"></textarea></div>
        <div style="display:flex;gap:12px;margin-top:4px;">
            <button class="btn btn-primary" onclick="submitBookingForm()">
                <i class="fa-solid fa-database" style="margin-right:8px;"></i>Save to Database
            </button>
            <button class="btn btn-outline" onclick="clearBookingForm()">
                <i class="fa-solid fa-rotate-left" style="margin-right:8px;"></i>Clear
            </button>
        </div>
    </div>

    <!-- Waitlist Card -->
    <div class="card" style="margin-bottom:24px;">
        <div class="section-header">
            <div>
                <h2><i class="fa-solid fa-people-line" style="color:var(--primary);margin-right:10px;"></i>Customer Waitlist Queue</h2>
                <p>${waitlist.length} customers waitlisted for occupied venues</p>
            </div>
        </div>
        ${waitlist.length === 0 ? `
            <div class="empty-state" style="padding:24px;">
                <i class="fa-solid fa-users-slash"></i>
                <h3>Waitlist is empty</h3>
                <p>No customers currently in the waitlist queue.</p>
            </div>
        ` : `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Room / Venue</th>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Event Name</th>
                            <th>Dates Requested</th>
                            <th>Guests</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${waitlist.map(w => `
                            <tr>
                                <td style="font-weight:700;">${w.room_name || '—'}</td>
                                <td style="font-weight:600;">${w.customer_name}</td>
                                <td style="color:var(--text-muted);">${w.customer_phone || '—'}</td>
                                <td>${w.event_name}</td>
                                <td style="font-size:13px;color:var(--text-muted);">${formatDate(w.date_start)} ${w.date_end ? '→ ' + formatDate(w.date_end) : ''}</td>
                                <td>${w.num_guests || '—'}</td>
                                <td>
                                    <button class="btn btn-danger btn-sm" onclick="deleteWaitlistEntry(${w.id})">
                                        <i class="fa-solid fa-xmark" style="margin-right:5px;"></i>Remove
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `}
    </div>

    <div class="card">
        <div class="section-header">
            <div><h2>All Bookings</h2><p>${store.data.reservations.length} records in database</p></div>
        </div>
        ${reservationTable(store.data.reservations, {})}
    </div>`;

    if ($('bk_booking_no')) $('bk_booking_no').value = generateLocalBookingNo();

    $('bk_inquiry_ref_no').onchange = (e) => {
        const ref = e.target.value;
        if (!ref) return;
        const inq = store.data.inquiries.find(i => i.ref_no === ref);
        if (inq) {
            $('bk_event_name').value = inq.event_type || '';
            $('bk_customer_name').value = inq.customer_name || '';
            $('bk_customer_phone').value = inq.customer_phone || '';
            if (inq.preferred_room_id) $('bk_room_id').value = inq.preferred_room_id;
            if (inq.preferred_date) $('bk_date_start').value = inq.preferred_date.split('T')[0];
            if (inq.num_guests) $('bk_num_guests').value = inq.num_guests;
            if (inq.budget) $('bk_total_price').value = inq.budget;
        }
    };
}

let _eventTab = 'General';
let _eventViewState = 'list'; // 'list', 'add', 'edit'
let _eventBuilderTab = 'General';

function renderEventBuilder(c) {
    const tabs = ['General Details', 'Venue & Room', 'Menu', 'Material', 'Event Order', 'Check List & Change', 'Event Extension', 'Payment Summary'];

    let tabsHtml = tabs.map(t => {
        const isActive = _eventBuilderTab === t;
        return `
            <button class="filter-tab ${isActive ? 'active' : ''}" onclick="_eventBuilderTab='${t}'; renderEventBuilder(document.getElementById('app-view'));" style="white-space:nowrap;">
                ${t}
            </button>
        `;
    }).join('');

    let contentHtml = '';
    if (_eventBuilderTab === 'General Details') {
        contentHtml = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px;">
                <div class="form-group">
                    <label>Booking No *</label>
                    <input type="text" id="eb_booking_no" readonly style="background:rgba(255,255,255,0.05); cursor:not-allowed;" placeholder="Auto-generated">
                </div>
                <div class="form-group">
                    <label>Pax Size *</label>
                    <input type="number" id="eb_pax_size">
                </div>
                
                <div class="form-group">
                    <label>Function Type</label>
                    <select id="eb_function_type">
                        <option>Shareholder Meeting</option>
                        <option>Corporate Gala</option>
                        <option>Wedding</option>
                        <option>Birthday Party</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Event Type *</label>
                    <select id="eb_event_type">
                        <option>Internal</option>
                        <option>External</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Package Type *</label>
                    <select id="eb_package_type">
                        <option>Standard Package</option>
                        <option>Premium Package</option>
                        <option>Custom Package</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Meal Type</label>
                    <select id="eb_meal_type">
                        <option>Buffet</option>
                        <option>Set Menu</option>
                        <option>A La Carte</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Start Date</label>
                    <input type="date" id="eb_start_date">
                </div>
                <div class="form-group">
                    <label>End Date</label>
                    <input type="date" id="eb_end_date">
                </div>

                <div class="form-group">
                    <label>Start Time</label>
                    <input type="time" id="eb_start_time">
                </div>
                <div class="form-group">
                    <label>End Time</label>
                    <input type="time" id="eb_end_time">
                </div>

                <div class="form-group">
                    <label>Meal Time</label>
                    <input type="time" id="eb_meal_time">
                </div>
                <div class="form-group">
                    <label>Children Count</label>
                    <input type="number" id="eb_children_count">
                </div>

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Description</label>
                    <textarea id="eb_description" rows="4" style="resize:vertical;"></textarea>
                </div>
            </div>

            <div style="display:flex;gap:12px;margin-top:4px;">
                <button class="btn btn-primary" onclick="submitEventBuilder()">
                    <i class="fa-solid fa-save" style="margin-right:8px;"></i>Save Event Details
                </button>
                <button class="btn btn-outline" onclick="_eventViewState='list'; navigate('/events');">
                    <i class="fa-solid fa-rotate-left" style="margin-right:8px;"></i>Cancel
                </button>
            </div>
        `;
    } else {
        contentHtml = `
            <div class="empty-state" style="padding: 50px;">
                <i class="fa-solid fa-person-digging"></i>
                <h3>Under Construction</h3>
                <p>Module for ${_eventBuilderTab} is under construction...</p>
                <button class="btn btn-outline" style="margin-top:16px;" onclick="_eventViewState='list'; navigate('/events');">Go Back</button>
            </div>
        `;
    }

    c.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
        <div class="section-header">
            <div>
                <h2><i class="fa-solid fa-calendar-plus" style="color:var(--primary);margin-right:10px;"></i>Add Event</h2>
                <p>Event Management</p>
            </div>
            <button class="btn btn-outline btn-sm" onclick="_eventViewState='list'; navigate('/events');">
                <i class="fa-solid fa-arrow-left" style="margin-right:6px;"></i>Back to List
            </button>
        </div>

        <div class="filter-tabs" style="margin-bottom:24px; overflow-x:auto; white-space:nowrap; display:flex; gap:8px;">
            ${tabsHtml}
        </div>

        ${contentHtml}
    </div>
    `;

    if (_eventBuilderTab === 'General Details') {
        if (!$('eb_booking_no').value) {
            $('eb_booking_no').value = generateLocalBookingNo();
        }
    }
}

async function submitEventBuilder() {
    const data = {
        booking_no: $('eb_booking_no').value,
        pax_size: parseInt($('eb_pax_size').value) || null,
        function_type: $('eb_function_type').value,
        event_type: $('eb_event_type').value,
        package_type: $('eb_package_type').value,
        meal_type: $('eb_meal_type').value,
        date_start: $('eb_start_date').value,
        date_end: $('eb_end_date').value,
        start_time: $('eb_start_time').value,
        end_time: $('eb_end_time').value,
        meal_time: $('eb_meal_time').value,
        children_count: parseInt($('eb_children_count').value) || null,
        description: $('eb_description').value,
        notes: $('eb_description').value,
        event_name: $('eb_function_type').value || 'New Event',
        customer_name: 'Walk-in Customer (Auto)',
        status: 'Confirmed'
    };

    if (!data.date_start) {
        showToast('Start Date is required!', 'error');
        return;
    }

    try {
        await store.fetchAPI('/reservations', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        showToast('Event created successfully!', 'success');
        await store.refreshData();
        _eventViewState = 'list';
        navigate('/events');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderEvents(c) {
    if (_eventViewState === 'add') {
        renderEventBuilder(c);
        return;
    }

    c.innerHTML = `
    <div class="card">
        <div class="section-header" style="margin-bottom: 20px;">
            <div>
                <h2><i class="fa-solid fa-champagne-glasses" style="color:var(--primary);margin-right:10px;"></i>Event Management</h2>
                <p>${store.data.reservations.length} events in database</p>
            </div>
            <button class="btn btn-primary" onclick="_eventViewState='add'; _eventBuilderTab='General Details'; navigate('/events');">
                <i class="fa-solid fa-plus" style="margin-right:8px;"></i>Add Event
            </button>
        </div>

        <div class="filter-tabs" style="margin-bottom:24px;">
            <button class="filter-tab ${_eventTab === 'General' ? 'active' : ''}" onclick="_eventTab='General'; navigate('/events');">
                <i class="fa-solid fa-table-list" style="margin-right:6px;"></i>General Details
            </button>
            <button class="filter-tab ${_eventTab === 'Menu' ? 'active' : ''}" onclick="_eventTab='Menu'; navigate('/events');">
                <i class="fa-solid fa-utensils" style="margin-right:6px;"></i>Menu Sections
            </button>
        </div>

        ${_eventTab === 'General' 
            ? reservationTable(store.data.reservations, { showConfirm: true, showReject: true, hideMenu: true })
            : eventMenuTable(store.data.reservations)
        }
    </div>`;
}

function renderRooms(c) {
    const { eventRooms, maintenanceTasks } = store.data;
    const icons = { Banquet: 'fa-champagne-glasses', Meeting: 'fa-briefcase', Outdoor: 'fa-tree', Conference: 'fa-people-group' };

    // Group tasks by room
    const tasksByRoom = {};
    (maintenanceTasks || []).forEach(t => {
        if (!tasksByRoom[t.room_id]) tasksByRoom[t.room_id] = [];
        tasksByRoom[t.room_id].push(t);
    });

    c.innerHTML = `
    <div class="section-header">
        <div>
            <h2><i class="fa-solid fa-door-open" style="color:var(--primary);margin-right:10px;"></i>Room Reservation</h2>
            <p>${eventRooms.length} venues in database</p>
        </div>
        
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">
        <div>
            ${eventRooms.length === 0 ? `<div class="card"><div class="empty-state"><i class="fa-solid fa-door-closed"></i><h3>No Venues in Database</h3><p>Add your first venue to get started</p></div></div>` : ''}
            <div class="rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
                ${eventRooms.map(r => `
                <div class="room-card">
                    <div class="room-icon"><i class="fa-solid ${icons[r.type] || 'fa-building'}"></i></div>
                    <div class="room-name">${r.name}</div>
                    <div class="room-price">${formatCurrency(r.price_per_day)} <span style="font-size:13px;font-weight:400;color:var(--text-muted);">/ day</span></div>
                    <div class="room-meta">
                        <span><i class="fa-solid fa-users" style="color:var(--primary);margin-right:5px;"></i>${r.capacity} guests</span>
                        <span><i class="fa-solid fa-tag" style="color:var(--primary);margin-right:5px;"></i>${r.type}</span>
                    </div>
                    <div style="margin-top:12px;">${statusBadge(r.status)}</div>
                    <div class="room-actions">
                        <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center;" onclick="openReservationModal()">
                            <i class="fa-solid fa-calendar-plus" style="margin-right:6px;"></i>Book
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="openRoomCalendar(${r.id})" title="View Timeline">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </button>
                        
                        
                    </div>
                </div>`).join('')}
            </div>
        </div>
        
        <!-- Checklist Side Card -->
        <div class="card">
            <h3 style="margin-bottom:12px;"><i class="fa-solid fa-screwdriver-wrench" style="color:var(--primary);margin-right:10px;"></i>Venue Setup & Cleaning</h3>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:20px;line-height:1.4;">Manage setup buffers and cleaning checklists before venues go back to Available.</p>
            
            ${eventRooms.length === 0 ? '<div style="font-size:13px;color:var(--text-muted);font-style:italic;">No venues registered yet.</div>' : ''}
            
            ${eventRooms.map(room => {
                const roomTasks = tasksByRoom[room.id] || [];
                const completed = roomTasks.filter(t => t.status === 'Completed');
                
                return `
                <div style="margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--glass-border); &:last-child { border: none; }">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="font-size:13px;color:var(--text-bright);">${room.name}</strong>
                        <span style="font-size:11px;background:rgba(0,242,254,0.1);color:var(--primary);padding:2px 6px;border-radius:8px;font-weight:600;">
                            ${completed.length}/${roomTasks.length} Done
                        </span>
                    </div>
                    ${roomTasks.length === 0 ? `
                        <div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:4px;">No active setup or cleaning tasks.</div>
                    ` : `
                        <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                            ${roomTasks.map(task => {
                                const isChecked = task.status === 'Completed';
                                return `
                                <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; cursor:pointer; user-select:none; line-height:1.3;">
                                    <input type="checkbox" ${isChecked ? 'checked' : ''} 
                                        onchange="toggleMaintenanceTask(${task.id}, this.checked)"
                                        style="width:14px; height:14px; margin-top:1px; cursor:pointer;">
                                    <span style="${isChecked ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${task.task_name}</span>
                                </label>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
                `;
            }).join('')}
        </div>
    </div>`;
}

async function toggleMaintenanceTask(id, isChecked) {
    const status = isChecked ? 'Completed' : 'Pending';
    try {
        await store.fetchAPI(`/maintenance-tasks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        await store.refreshData();
        showToast(`Task marked as ${status} ✓`, 'success');
    } catch (err) {
        showToast('Failed to update task: ' + err.message, 'danger');
    }
}

function renderAgreement(c) {
    const confirmed = store.data.reservations.filter(r => r.status === 'Confirmed');
    c.innerHTML = `
    <div class="card">
        <div class="section-header">
            <div>
                <h2><i class="fa-solid fa-file-contract" style="color:var(--primary);margin-right:10px;"></i>Agreements</h2>
                <p>${confirmed.length} confirmed bookings from database</p>
            </div>
        </div>
        <div class="table-wrapper">
            <table class="data-table">
                <thead><tr><th>Ref #</th><th>Event</th><th>Customer</th><th>Venue</th><th>Value</th><th>Event Date</th><th>Actions</th></tr></thead>
                <tbody>
                    ${confirmed.length === 0
                        ? `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-file-circle-xmark"></i><h3>No Agreements</h3><p>Confirm reservations to generate agreements</p></div></td></tr>`
                        : confirmed.map(r => `
                        <tr>
                            <td style="color:var(--primary);font-weight:700;">AGR-${String(r.id).padStart(4,'0')}</td>
                            <td style="font-weight:700;">${r.event_name}</td>
                            <td>
                                ${r.customer_name}<br>
                                <span style="font-size:12px;color:var(--text-muted);">${r.customer_phone || ''}</span>
                            </td>
                            <td style="color:var(--text-muted);">${r.room_name || '—'}</td>
                            <td style="color:var(--primary);font-weight:700;">${formatCurrency(r.total_price)}</td>
                            <td style="font-size:13px;color:var(--text-muted);">${formatDate(r.date_start)} → ${formatDate(r.date_end)}</td>
                            <td>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-outline btn-sm" onclick="printAgreement(${r.id},'${r.event_name}','${r.customer_name}')">
                                        <i class="fa-solid fa-print" style="margin-right:5px;"></i>Print
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="updateReservationStatus(${r.id},'Cancelled')">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

let _currentSigningReservationId = null;
let _sigCanvas = null;
let _sigCtx = null;
let _isDrawing = false;

function initSignatureCapture(reservationId) {
    _currentSigningReservationId = reservationId;
    openModal('signatureModal');
    
    if (!_sigCanvas) {
        _sigCanvas = $('sigCanvas');
        _sigCtx = _sigCanvas.getContext('2d');
        
        _sigCtx.strokeStyle = '#ffffff';
        _sigCtx.lineWidth = 3;
        _sigCtx.lineCap = 'round';
        
        _sigCanvas.addEventListener('mousedown', startDrawing);
        _sigCanvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);
        
        _sigCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = _sigCanvas.getBoundingClientRect();
            _sigCtx.beginPath();
            _sigCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
            _isDrawing = true;
        }, { passive: false });
        
        _sigCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!_isDrawing) return;
            const touch = e.touches[0];
            const rect = _sigCanvas.getBoundingClientRect();
            _sigCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
            _sigCtx.stroke();
        }, { passive: false });
        
        _sigCanvas.addEventListener('touchend', () => { _isDrawing = false; });
        
        $('saveSignatureBtn').addEventListener('click', saveSignature);
    }
    clearCanvas();
}

function startDrawing(e) {
    const rect = _sigCanvas.getBoundingClientRect();
    _sigCtx.beginPath();
    _sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    _isDrawing = true;
}

function draw(e) {
    if (!_isDrawing) return;
    const rect = _sigCanvas.getBoundingClientRect();
    _sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    _sigCtx.stroke();
}

function stopDrawing() {
    _isDrawing = false;
}

function clearCanvas() {
    if (_sigCtx && _sigCanvas) {
        _sigCtx.clearRect(0, 0, _sigCanvas.width, _sigCanvas.height);
    }
}

async function saveSignature() {
    if (!_currentSigningReservationId) return;
    const dataUrl = _sigCanvas.toDataURL();
    try {
        await store.fetchAPI(`/reservations/${_currentSigningReservationId}/signature`, {
            method: 'PATCH',
            body: JSON.stringify({ signature_data: dataUrl })
        });
        showToast('E-Signature saved to database ✓', 'success');
        closeModal('signatureModal');
        await store.refreshData();
        printAgreement(_currentSigningReservationId);
    } catch (err) {
        showToast('Failed to save signature: ' + err.message, 'danger');
    }
}

async function printAgreement(id) {
    const r = store.data.reservations.find(res => res.id === id);
    if (!r) { showToast('Reservation not found', 'danger'); return; }

    if (!r.signature_data) {
        initSignatureCapture(id);
        return;
    }

    let billRows = '';
    let grandTotal = parseFloat(r.total_price) || 0;
    try {
        const res = await fetch(`/api/reservations/${id}/orders`);
        const orders = await res.json();
        if (orders && orders.length > 0) {
            orders.forEach(o => {
                if (o.items && o.items.length > 0) {
                    o.items.forEach(item => {
                        const itemTotal = item.price * item.qty;
                        grandTotal += itemTotal;
                        billRows += `
                        <tr>
                            <td>[Order #${o.id}] ${item.qty}x ${item.dish_name}</td>
                            <td>${sym()}${parseFloat(item.price).toLocaleString(undefined, {minimumFractionDigits: 2})} each</td>
                            <td style="font-weight: bold; color: #000;">${sym()}${parseFloat(itemTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>`;
                    });
                }
            });
        }
    } catch(e) { console.error('Failed to fetch detailed bills', e); }

    const w = window.open('', '_blank');
    const currency = sym();
    const dateFormatted = formatDate(r.date_start);
    const dateEndFormatted = r.date_end ? formatDate(r.date_end) : dateFormatted;

    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Agreement - AGR-${String(r.id).padStart(4, '0')}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Outfit', sans-serif; color: #222; padding: 40px; line-height: 1.6; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; }
                .header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
                .agreement-title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 30px; text-transform: uppercase; text-decoration: underline; }
                
                /* Borderless tables reset */
                .meta-table, .signature-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: none !important;
                    margin-bottom: 30px;
                    background: transparent !important;
                }
                .meta-table td, .signature-table td {
                    border: none !important;
                    padding: 0 !important;
                    background: transparent !important;
                    text-align: left;
                    vertical-align: top;
                }
                
                .meta-table {
                    border-bottom: 1px solid #eee;
                    font-weight: bold;
                    font-size: 14px;
                }
                .meta-table td {
                    padding: 0 0 10px 0 !important;
                }
                
                .info-table { width: 100%; border: none; margin-bottom: 30px; border-collapse: collapse; }
                .info-table td { border: none !important; padding: 10px 20px 10px 0 !important; background: transparent !important; }
                .info-table td.right-col { border-left: 1px solid #eee !important; padding: 10px 0 10px 20px !important; }
                
                .section-title { font-weight: bold; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f5f5f5; }
                
                .terms { font-size: 12px; color: #555; border-top: 1px solid #eee; padding-top: 20px; margin-top: 50px; }
                
                /* Signature section styles */
                .signature-table {
                    margin-top: 80px;
                }
                .signature-table td {
                    width: 43%;
                    vertical-align: bottom;
                    text-align: center;
                }
                .signature-table td.spacer {
                    width: 14%;
                }
                .signature-space {
                    height: 90px;
                    text-align: center;
                    font-size: 0;
                    line-height: 90px;
                    margin-bottom: 10px;
                }
                .signature-space img {
                    max-height: 90px;
                    max-width: 240px;
                    vertical-align: bottom;
                    display: inline-block;
                    filter: invert(1);
                }
                .signature-line-text {
                    border-top: 1px solid #000;
                    padding-top: 8px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                
                .print-btn-container { text-align: center; margin-top: 40px; }
                @media print {
                    body { padding: 20px; }
                    .print-btn-container { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${store.data.settings.business_name || 'ASCENDIA BANQUETS'}</h1>
                <p>${store.data.settings.business_name || 'ASCENDIA BANQUETS'} · General Agreement</p>
            </div>
            
            <div class="agreement-title">${(store.data.settings.business_name || 'ASCENDIA BANQUETS').toUpperCase()} AGREEMENT</div>
            
            <table class="meta-table">
                <tr>
                    <td style="text-align: left;">
                        Agreement Reference: AGR-${String(r.id).padStart(4, '0')}<br>
                        Booking Reference: ${r.booking_no || 'BKG-'+String(r.id).padStart(4, '0')}
                    </td>
                    <td style="text-align: right; vertical-align: bottom;">Date Generated: ${new Date().toLocaleDateString('en-GB')}</td>
                </tr>
            </table>

            <table class="info-table">
                <tr>
                    <td style="width: 50%; vertical-align: top;">
                        <div class="section-title">Client Information</div>
                        <div style="line-height: 1.8; font-size: 14px;">
                            <strong>Name:</strong> ${r.customer_name}<br>
                            <strong>Contact Phone:</strong> ${r.customer_phone || '—'}<br>
                        </div>
                    </td>
                    <td class="right-col" style="width: 50%; vertical-align: top;">
                        <div class="section-title">Venue & Event Details</div>
                        <div style="line-height: 1.8; font-size: 14px;">
                            <strong>Venue / Room:</strong> ${r.room_name || 'General Venue'}<br>
                            <strong>Event Name:</strong> ${r.event_name}<br>
                            <strong>Date of Event:</strong> ${dateFormatted} to ${dateEndFormatted}<br>
                            <strong>Number of Guests:</strong> ${r.num_guests || '—'}
                        </div>
                    </td>
                </tr>
            </table>

            ${r.menu_selections ? `
            <div class="section-title">Selected Menu & Catering Details</div>
            <div style="margin-bottom: 30px; font-size: 14px; line-height: 1.6; border: 1px solid #ddd; padding: 15px; background: #fdfdfd;">
                ${Object.entries(typeof r.menu_selections === 'string' ? JSON.parse(r.menu_selections) : r.menu_selections).map(([cat, items]) => 
                    `<strong style="text-transform: uppercase; font-size: 12px; color: #555;">${cat}:</strong><br>
                     <div style="padding-left: 10px; margin-bottom: 8px;">${items.join(', ')}</div>`
                ).join('')}
            </div>` : ''}

            <div class="section-title">Billing & Financial Breakdown</div>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Price Rate</th>
                        <th>Total Price</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Banquet Hall / Event Room reservation for dates: ${dateFormatted} to ${dateEndFormatted}</td>
                        <td>${formatCurrency(r.price_per_day)} / day</td>
                        <td style="font-weight: bold; color: #000;">${formatCurrency(r.total_price)}</td>
                    </tr>
                    ${billRows}
                    <tr>
                        <td colspan="2" style="text-align: right; font-weight: bold; font-size: 16px;">GRAND TOTAL:</td>
                        <td style="font-weight: bold; color: #000; font-size: 16px;">${sym()}${parseFloat(grandTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                </tbody>
            </table>

            <div class="terms">
                <strong>TERMS & CONDITIONS:</strong><br>
                1. The client agrees to pay the total reservation fee at least 7 days before the event starts.<br>
                2. Cancellations made within 48 hours of the event are non-refundable. Cancellations prior to this are eligible for 50% refund.<br>
                3. The client is responsible for any damage caused to properties or venues during the event.<br>
                4. Ascendia Hotel guarantees the reserved room will be set up and prepared according to specification detailed in internal notes.
            </div>

            <table class="signature-table">
                <tr>
                    <td>
                        <div class="signature-space"></div>
                        <div class="signature-line-text">
                            Authorized Signatory<br>
                            <span style="font-size: 12px; color: #666;">${store.data.settings.business_name || 'ASCENDIA BANQUETS'}</span>
                        </div>
                    </td>
                    <td class="spacer"></td>
                    <td>
                        <div class="signature-space">
                            <img src="${r.signature_data}" alt="Customer Signature">
                        </div>
                        <div class="signature-line-text">
                            <strong>${r.customer_name}</strong><br>
                            <span style="font-size: 12px; color: #666;">Customer Signature (E-Signed)</span>
                        </div>
                    </td>
                </tr>
            </table>

            <div class="print-btn-container">
                <button onclick="window.print();" style="padding: 10px 20px; font-size: 16px; background: #00f2fe; border: none; border-radius: 6px; cursor: pointer; color: black; font-weight: bold;">Print Document</button>
            </div>
        </body>
        </html>
    `);
    w.document.close();
}

function renderApproval(c) {
    const pending = store.data.reservations.filter(r => r.status === 'Pending');
    c.innerHTML = `
    <div class="card">
        <div class="section-header">
            <div>
                <h2><i class="fa-solid fa-stamp" style="color:var(--primary);margin-right:10px;"></i>Sales Head Approval</h2>
                <p>${pending.length} reservation(s) awaiting approval in database</p>
            </div>
        </div>
        ${pending.length === 0
            ? `<div class="empty-state">
                <i class="fa-solid fa-circle-check" style="color:#10b981;opacity:1;font-size:56px;margin-bottom:16px;"></i>
                <h3>All Clear!</h3>
                <p>No pending approvals at this time.</p>
               </div>`
            : `<div class="table-wrapper"><table class="data-table">
                <thead><tr><th>Event</th><th>Customer</th><th>Venue</th><th>Guests</th><th>Date</th><th>Decision</th></tr></thead>
                <tbody>
                ${pending.map(r => `
                    <tr>
                        <td style="vertical-align:top;">
                            <div style="font-weight:700;">${r.event_name}</div>
                            ${r.menu_selections ? `
                            <div style="margin-top:8px;padding:8px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.05);border-radius:6px;font-size:11px;line-height:1.4;">
                                <strong style="color:var(--primary);display:block;margin-bottom:4px;">Menu Requested:</strong>
                                ${Object.entries(typeof r.menu_selections === 'string' ? JSON.parse(r.menu_selections) : r.menu_selections).map(([cat, items]) => 
                                    `<div style="margin-bottom:3px;"><span style="color:#a8b2d1;font-weight:600;">${cat}:</span> ${items.join(', ')}</div>`
                                ).join('')}
                            </div>` : ''}
                        </td>
                        <td style="vertical-align:top;">${r.customer_name}<br><span style="font-size:12px;color:var(--text-muted);">${r.customer_phone || ''}</span></td>
                        <td style="vertical-align:top;color:var(--text-muted);">${r.room_name || '—'}</td>
                        <td style="vertical-align:top;">${r.num_guests || '—'}</td>
                        <td style="vertical-align:top;font-size:13px;color:var(--text-muted);">${formatDate(r.date_start)}</td>
                        <td style="vertical-align:top;">
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <button class="btn btn-primary btn-sm" onclick="updateReservationStatus(${r.id},'Confirmed')">
                                    <i class="fa-solid fa-check" style="margin-right:5px;"></i>Approve & Save
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="updateReservationStatus(${r.id},'Cancelled')">
                                    <i class="fa-solid fa-xmark" style="margin-right:5px;"></i>Reject
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
                </tbody>
            </table></div>`}
    </div>`;
}

let _currentCalYear = new Date().getFullYear();
let _currentCalMonth = new Date().getMonth();
let _calRoomFilter = '';

window.changeCalMonth = function(offset) {
    _currentCalMonth += offset;
    if (_currentCalMonth < 0) {
        _currentCalMonth = 11;
        _currentCalYear--;
    } else if (_currentCalMonth > 11) {
        _currentCalMonth = 0;
        _currentCalYear++;
    }
    navigate('/calendar');
};

window.changeCalRoomFilter = function(value) {
    _calRoomFilter = value;
    navigate('/calendar');
};

function getRoomStatusForDate(room, dateKey) {
    const resList = store.data.reservations.filter(r => 
        r.status !== 'Cancelled' && 
        r.room_id === room.id && 
        dateKey >= r.date_start.split('T')[0] && 
        dateKey <= (r.date_end || r.date_start).split('T')[0]
    );

    if (resList.length === 0) {
        return { status: 'available', reservations: [] };
    }

    const confirmed = resList.find(r => r.status === 'Confirmed');
    if (confirmed) {
        const hasPendingPrep = store.data.maintenanceTasks.some(t => t.reservation_id === confirmed.id && t.status === 'Pending');
        return { 
            status: hasPendingPrep ? 'maintenance' : 'booked', 
            reservations: [confirmed] 
        };
    }

    const pending = resList.find(r => r.status === 'Pending');
    if (pending) {
        return { status: 'pending', reservations: [pending] };
    }

    return { status: 'available', reservations: [] };
}

function renderCalendar(c) {
    const year = _currentCalYear;
    const month = _currentCalMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    let cells = '';
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    for (let i = 0; i < firstDay; i++) {
        cells += `<div class="cal-cell empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === todayDay && year === todayYear && month === todayMonth;
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(d).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        let statusClass = '';
        let cellContent = '';
        let tooltipContent = '';

        if (_calRoomFilter !== '') {
            const selectedRoom = store.data.eventRooms.find(rm => rm.id === parseInt(_calRoomFilter));
            if (selectedRoom) {
                const res = getRoomStatusForDate(selectedRoom, dateKey);
                statusClass = `status-${res.status}`;
                
                if (res.status !== 'available') {
                    tooltipContent = `
                        <div class="cal-tooltip">
                            <div class="cal-tooltip-title">
                                <span>${res.status === 'maintenance' ? 'Maintenance Prep' : 'Booking Details'}</span>
                                <span style="font-size: 10px; opacity: 0.8; font-weight: normal;">${selectedRoom.name}</span>
                            </div>
                            ${res.reservations.map(r => `
                                <div class="cal-tooltip-detail"><strong>Event:</strong> ${r.event_name}</div>
                                <div class="cal-tooltip-detail"><strong>Client:</strong> ${r.customer_name}</div>
                                <div class="cal-tooltip-detail"><strong>Phone:</strong> ${r.customer_phone || '—'}</div>
                                <div class="cal-tooltip-detail"><strong>Status:</strong> ${r.status} ${res.status === 'maintenance' ? '(Prep Pending)' : ''}</div>
                                <div class="cal-tooltip-detail"><strong>Guests:</strong> ${r.num_guests || '—'}</div>
                                <a href="#" class="cal-tooltip-link" onclick="printAgreement(${r.id}); event.stopPropagation();">
                                    <i class="fa-solid fa-print" style="margin-right:4px;"></i>Print Agreement
                                </a>
                            `).join('')}
                        </div>
                    `;
                }
            }
        } else {
            // All rooms dots indicator
            const roomStatuses = store.data.eventRooms.map(room => ({
                room,
                res: getRoomStatusForDate(room, dateKey)
            }));
            
            const occupiedRooms = roomStatuses.filter(rs => rs.res.status !== 'available');
            
            cellContent = `
                <div class="cal-dots-container">
                    ${roomStatuses.map(rs => `
                        <div class="cal-dot ${rs.res.status}" title="${rs.room.name}: ${rs.res.status}"></div>
                    `).join('')}
                </div>
            `;
            
            if (occupiedRooms.length > 0) {
                tooltipContent = `
                    <div class="cal-tooltip">
                        <div class="cal-tooltip-title">Venue Occupancy</div>
                        ${occupiedRooms.map(rs => `
                            <div style="margin-bottom: 8px; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 6px;">
                                <div style="font-weight: bold; color: var(--primary); font-size: 11px; margin-bottom:2px;">
                                    ${rs.room.name} (${rs.res.status.toUpperCase()})
                                </div>
                                ${rs.res.reservations.map(r => `
                                    <div class="cal-tooltip-detail"><strong>Event:</strong> ${r.event_name}</div>
                                    <div class="cal-tooltip-detail"><strong>Client:</strong> ${r.customer_name}</div>
                                    <a href="#" class="cal-tooltip-link" onclick="printAgreement(${r.id}); event.stopPropagation();">
                                        <i class="fa-solid fa-print" style="margin-right:4px;"></i>Print Agreement
                                    </a>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        cells += `
            <div class="cal-cell ${isToday ? 'today' : ''} ${statusClass}">
                <div style="z-index: 2;">${d}</div>
                ${cellContent}
                ${tooltipContent}
            </div>
        `;
    }

    const thisMonthRes = store.data.reservations.filter(r => {
        const d = new Date(r.date_start);
        const matchesDate = d.getFullYear() === year && d.getMonth() === month;
        const matchesRoom = _calRoomFilter === '' || r.room_id === parseInt(_calRoomFilter);
        return matchesDate && matchesRoom;
    });

    c.innerHTML = `
    <div style="display:grid;grid-template-columns:420px 1fr;gap:24px;align-items:start;">
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="btn btn-outline btn-sm" onclick="changeCalMonth(-1)" style="padding: 6px 10px;">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <h3 style="margin: 0; min-width: 140px; text-align: center; font-size: 16px;">${monthNames[month]} ${year}</h3>
                    <button class="btn btn-outline btn-sm" onclick="changeCalMonth(1)" style="padding: 6px 10px;">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <div class="form-group" style="margin-bottom:0; width:150px;">
                    <select id="cal_room_filter" onchange="changeCalRoomFilter(this.value)" style="padding: 6px 12px; font-size:12px; background: rgba(255,255,255,0.05); color:#fff; border-radius:8px; border:1px solid var(--glass-border); width:100%;">
                        <option value="">-- All Venues --</option>
                        ${store.data.eventRooms.map(rm => `<option value="${rm.id}" ${parseInt(_calRoomFilter) === rm.id ? 'selected' : ''}>${rm.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div class="cal-grid" style="margin-bottom:8px;">
                ${dayNames.map(d => `<div class="cal-header-cell">${d}</div>`).join('')}
            </div>
            <div class="cal-grid" style="margin-top:0;">${cells}</div>
            
            <div style="display:flex; flex-wrap:wrap; gap:12px 16px; margin-top:20px; padding-top:16px; border-top:1px solid var(--glass-border);">
                <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);">
                    <div style="width:10px;height:10px;border-radius:3px;background:rgba(16, 185, 129, 0.2);border:1px solid #10b981;"></div> Available
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);">
                    <div style="width:10px;height:10px;border-radius:3px;background:rgba(239, 68, 68, 0.2);border:1px solid #ef4444;"></div> Booked
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);">
                    <div style="width:10px;height:10px;border-radius:3px;background:rgba(245, 158, 11, 0.2);border:1px solid #f59e0b;"></div> Pending
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);">
                    <div style="width:10px;height:10px;border-radius:3px;background:rgba(249, 115, 22, 0.2);border:1px solid #f97316;"></div> Buffer Prep
                </div>
            </div>
        </div>

        <div class="card">
            <div class="section-header">
                <div>
                    <h2>Bookings & Statuses</h2>
                    <p>${thisMonthRes.length} item(s) found for selected filter</p>
                </div>
            </div>
            ${reservationTable(thisMonthRes, {})}
        </div>
    </div>`;
}

function renderReports(c) {
    const { reservations, eventRooms } = store.data;
    const revenue = reservations.reduce((a, r) => a + parseFloat(r.total_price || 0), 0);
    const byStatus = { Confirmed: 0, Pending: 0, Cancelled: 0 };
    reservations.forEach(r => { if (byStatus[r.status] !== undefined) byStatus[r.status]++; });

    const byVenue = {};
    reservations.forEach(r => {
        const vn = r.room_name || 'No Venue';
        if (!byVenue[vn]) byVenue[vn] = { count: 0, revenue: 0 };
        byVenue[vn].count++;
        byVenue[vn].revenue += parseFloat(r.total_price || 0);
    });
    const topVenue = Object.entries(byVenue).sort((a,b) => b[1].revenue - a[1].revenue)[0];

    c.innerHTML = `
    <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card"><div class="stat-icon" style="background:rgba(0,242,254,0.15);"><i class="fa-solid fa-calendar-check" style="color:#00f2fe;"></i></div><div><div class="stat-value">${reservations.length}</div><div class="stat-label">Total Bookings (DB)</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(16,185,129,0.15);"><i class="fa-solid fa-circle-check" style="color:#10b981;"></i></div><div><div class="stat-value">${byStatus.Confirmed}</div><div class="stat-label">Confirmed</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(245,158,11,0.15);"><i class="fa-solid fa-clock" style="color:#f59e0b;"></i></div><div><div class="stat-value">${byStatus.Pending}</div><div class="stat-label">Pending Approval</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:rgba(245,158,11,0.15);"><i class="fa-solid fa-sack-dollar" style="color:#f59e0b;"></i></div><div><div class="stat-value" style="font-size:18px;">${formatCurrency(revenue)}</div><div class="stat-label">Total Revenue (DB)</div></div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="card">
            <h3 style="margin-bottom:20px;">Bookings by Status</h3>
            ${Object.entries(byStatus).map(([s, n]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">${statusBadge(s)}</div>
                    <div style="font-weight:700;">${n}</div>
                </div>
                <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.08);margin-bottom:16px;">
                    <div style="height:100%;border-radius:4px;background:var(--primary);width:${reservations.length ? Math.round(n/reservations.length*100) : 0}%;transition:width 0.6s ease;"></div>
                </div>
            `).join('')}
        </div>

        <div class="card">
            <h3 style="margin-bottom:20px;">Revenue by Venue</h3>
            ${Object.keys(byVenue).length === 0
                ? `<div class="empty-state"><i class="fa-solid fa-chart-bar"></i><h3>No Data</h3><p>Add reservations to see revenue breakdown</p></div>`
                : Object.entries(byVenue).sort((a,b) => b[1].revenue - a[1].revenue).map(([venue, data]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                    <div>
                        <div style="font-weight:700;font-size:14px;">${venue}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${data.count} booking(s)</div>
                    </div>
                    <div style="color:var(--primary);font-weight:700;">${formatCurrency(data.revenue)}</div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

async function markNotifRead(id) {
    try {
        await store.fetchAPI('/notifications/' + id + '/mark_read', { method: 'POST' });
        await store.fetchNotifications();
    } catch (err) {
        console.error(err);
    }
}

function renderSettings(c) {
    c.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
        <div class="section-header">
            <div>
                <h2><i class="fa-solid fa-gear" style="color:var(--primary);margin-right:10px;"></i>System Settings</h2>
                <p>Configure the Reservation Module</p>
            </div>
        </div>
        <div style="max-width:600px;">
            <div class="form-group"><label>Business Name</label><input type="text" value="${store.data.settings.business_name}" id="set_name"></div>
            <div class="form-group"><label>Currency Symbol</label><input type="text" value="${store.data.settings.currency_symbol}" id="set_currency" style="max-width:100px;"></div>
            <div class="form-group"><label>Default Reservation Status</label>
                <select id="set_default_status"><option value="Pending">Pending</option><option value="Confirmed" selected>Confirmed</option></select>
            </div>
            <div style="display:flex;gap:12px;">
                <button class="btn btn-primary" onclick="saveSettings()">
                    <i class="fa-solid fa-floppy-disk" style="margin-right:8px;"></i>Save Settings
                </button>
            </div>
        </div>
    </div>

    <div class="card">
        <h3 style="margin-bottom:20px;"><i class="fa-solid fa-database" style="color:var(--primary);margin-right:10px;"></i>Database & Connections</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div style="padding:16px;border:1px solid var(--glass-border);border-radius:16px;">
                <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">POS Module</div>
                <div style="font-weight:700;color:var(--primary);">http://localhost:301</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Shared SQLite database</div>
            </div>
            <div style="padding:16px;border:1px solid var(--primary);border-radius:16px;background:var(--primary-light);">
                <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Reservation Module</div>
                <div style="font-weight:700;color:var(--primary);">http://localhost:302</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Active — pos_data.db</div>
            </div>
        </div>
        <div style="display:flex;gap:12px;">
            <a href="http://localhost:301" target="_blank" class="btn btn-outline">
                <i class="fa-solid fa-cash-register" style="margin-right:8px;"></i>Open POS Module
            </a>
            <button class="btn btn-outline" onclick="store.refreshData().then(()=>showToast('All data synced from pos_data.db ✓','success'))">
                <i class="fa-solid fa-rotate-right" style="margin-right:8px;"></i>Force DB Sync
            </button>
        </div>
        <p style="margin-top:16px;color:var(--text-muted);font-size:13px;">
            <i class="fa-solid fa-circle-info" style="color:var(--primary);margin-right:6px;"></i>
            Both modules share the same <code style="color:var(--primary);">pos_data.db</code> SQLite file. All CRUD operations are persisted in real-time.
        </p>
    </div>`;
}

async function saveSettings() {
    const businessName = $('set_name').value.trim();
    const currencySymbol = $('set_currency').value.trim();
    if (!businessName) { showToast('Business name cannot be empty', 'danger'); return; }
    try {
        await store.fetchAPI('/settings', {
            method: 'PUT',
            body: JSON.stringify({ business_name: businessName, currency_symbol: currencySymbol })
        });
        showToast('Settings saved successfully ✓', 'success');
        await store.refreshData();
        navigate('/settings');
    } catch (err) {
        showToast('Failed to save settings: ' + err.message, 'danger');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE APPROVAL VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function renderFinance(c) {
    const pendingFinance = store.data.reservations.filter(r => r.status === 'Pending Finance');
    c.innerHTML = `
    <div class="header">
        <div class="header-title">
            <h1 class="page-title"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--primary);margin-right:10px;"></i>Finance Approvals</h1>
            <p style="color:var(--text-muted);font-size:14px;margin-top:5px;">Approve advance payments to confirm bookings.</p>
        </div>
    </div>
    
    <div class="card" style="margin-top:20px;">
        ${pendingFinance.length === 0 ? `
            <div class="empty-state">
                <i class="fa-solid fa-check-double"></i>
                <h3>All Caught Up!</h3>
                <p>No bookings pending finance approval right now.</p>
            </div>
        ` : `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Ref #</th><th>Event</th><th>Customer</th><th>Dates</th><th>Total Price</th><th>Action</th></tr></thead>
                    <tbody>
                        ${pendingFinance.map(r => `
                            <tr>
                                <td><span style="font-family:monospace; color:var(--text-muted);">${r.booking_no || '—'}</span></td>
                                <td style="font-weight:700;">${r.event_name}</td>
                                <td>${r.customer_name}<br><small style="color:var(--text-muted)">${r.customer_phone || ''}</small></td>
                                <td>${formatDate(r.date_start)} ${r.date_end ? 'to ' + formatDate(r.date_end) : ''}</td>
                                <td><span style="color:var(--primary);font-weight:700;">${formatCurrency(r.total_price)}</span></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" onclick="approveFinance(${r.id})">
                                        <i class="fa-solid fa-check" style="margin-right:5px;"></i>Approve
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `}
    </div>
    `;
}

function approveFinance(id) {
    document.getElementById('financeApproveResId').value = id;
    document.getElementById('financePaymentSlipInput').value = '';
    document.getElementById('financeSlipPreview').style.display = 'none';
    document.getElementById('financeSlipImg').src = '';
    openModal('financeApproveModal');
}

// Add event listener for slip preview
document.addEventListener('DOMContentLoaded', () => {
    const slipInput = document.getElementById('financePaymentSlipInput');
    if (slipInput) {
        slipInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    document.getElementById('financeSlipImg').src = evt.target.result;
                    document.getElementById('financeSlipPreview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

async function submitFinanceApprove() {
    const id = document.getElementById('financeApproveResId').value;
    const base64Image = document.getElementById('financeSlipImg').src;
    
    const amount = document.getElementById('financePaymentAmount').value;

    if (!amount || amount <= 0) {
        showToast('Please enter a valid advance payment amount.', 'warning');
        return;
    }
    
    if (!base64Image || base64Image === window.location.href) {
        showToast('Please attach a payment slip before approving.', 'warning');
        return;
    }

    try {
        const res = await store.fetchAPI('/reservations/' + id + '/finance_approve', { 
            method: 'POST',
            body: JSON.stringify({ payment_slip: base64Image, amount: parseFloat(amount) })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        showToast('Booking Approved and Confirmed ✓', 'success');
        closeModal('financeApproveModal');
        await store.refreshData();
        navigate('/finance');
    } catch(err) {
        showToast('Approval Failed: ' + err.message, 'danger');
    }
}

async function payAdvance(id, totalPrice) {
    const amountStr = prompt(`Enter advance payment amount (Total Price: ${formatCurrency(totalPrice)}):`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        showToast('Invalid amount', 'danger');
        return;
    }
    try {
        await store.fetchAPI('/reservations/' + id + '/advance_payment', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
        showToast('Advance payment recorded. Status changed to Pending Finance ✓', 'success');
        await store.refreshData();
        navigate(currentRoute);
    } catch(err) {
        showToast('Payment Failed: ' + err.message, 'danger');
    }
}

function viewSlip(id) {
    const r = store.data.reservations.find(res => res.id === id);
    if (!r) return;

    const img = document.getElementById('viewSlipImg');
    const noData = document.getElementById('viewSlipNoData');
    
    if (r.payment_slip) {
        img.src = r.payment_slip;
        img.style.display = 'block';
        noData.style.display = 'none';
    } else {
        img.style.display = 'none';
        noData.style.display = 'block';
    }

    openModal('viewSlipModal');
}


// ═══════════════════════════════════════════════════════════════════════════════
// HOTEL ROOMS VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function renderHotelRooms(wrapper) {
    wrapper.innerHTML = `
        <div class="view-header">
            <div>
                <h1 class="view-title">Hotel Rooms</h1>
                <p class="view-subtitle">Manage accommodation rooms and availability</p>
            </div>
        </div>

        <div style="background:var(--glass-bg); backdrop-filter:var(--glass-blur); border:1px solid var(--glass-border); border-radius:12px; padding:20px; box-shadow:var(--shadow-lg);">
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Room No.</th>
                            <th>Type</th>
                            <th>Capacity</th>
                            <th>Price/Night</th>
                            <th>Status</th>
                            <th style="text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="hotel_rooms_tbody">
                        <tr><td colspan="6" style="text-align:center; padding:20px;"><div class="spinner"></div></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const tbody = $('hotel_rooms_tbody');
    const rooms = store.data.hotelRooms || [];

    if (rooms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">No hotel rooms configured yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = rooms.map(r => `
        <tr>
            <td style="font-weight:600;"><i class="fa-solid fa-bed" style="color:var(--primary);margin-right:8px;"></i>${r.room_number}</td>
            <td><span class="badge badge-info">${r.room_type}</span></td>
            <td>${r.capacity} Pax</td>
            <td>${sym()}${r.price_per_night}</td>
            <td>${statusBadge(r.status)}</td>
            <td style="text-align:right;">
                <span style="font-size:12px; color:var(--text-muted);">Master Data</span>
            </td>
        </tr>
    `).join('');
}

let _editingHotelRoomId = null;

function openHotelRoomModal(roomOrId = null) {
    const room = (roomOrId && typeof roomOrId !== 'object') ? store.data.hotelRooms.find(r => r.id === roomOrId) : roomOrId;
    _editingHotelRoomId = room ? room.id : null;
    
    $('hotel_room_number').value   = room ? room.room_number     : '';
    $('hotel_room_type').value     = room ? room.room_type       : 'Standard';
    $('hotel_room_capacity').value = room ? room.capacity        : '';
    $('hotel_room_price').value    = room ? room.price_per_night : '';
    $('hotel_room_status').value   = room ? room.status          : 'Available';
    
    $('hotelRoomModal').querySelector('h3').innerHTML =
        `<i class="fa-solid fa-bed" style="color:var(--primary);margin-right:10px;"></i>${_editingHotelRoomId ? 'Edit Hotel Room' : 'Add Hotel Room'}`;
    
    openModal('hotelRoomModal');
}

async function submitHotelRoom() {
    const body = {
        room_number:     $('hotel_room_number').value.trim(),
        room_type:       $('hotel_room_type').value,
        capacity:        parseInt($('hotel_room_capacity').value),
        price_per_night: parseFloat($('hotel_room_price').value),
        status:          $('hotel_room_status').value
    };
    
    if (!body.room_number) { showToast('Room number is required', 'warning'); return; }
    if (isNaN(body.capacity) || body.capacity < 1) { showToast('Capacity must be a valid number > 0', 'warning'); return; }
    if (isNaN(body.price_per_night) || body.price_per_night < 0) { showToast('Price must be a valid positive number', 'warning'); return; }

    try {
        if (_editingHotelRoomId) {
            await store.fetchAPI(`/hotel-rooms/${_editingHotelRoomId}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Hotel Room updated ✓', 'success');
        } else {
            await store.fetchAPI('/hotel-rooms', { method: 'POST', body: JSON.stringify(body) });
            showToast('Hotel Room saved ✓', 'success');
        }
        closeModal('hotelRoomModal');
        await store.refreshData();
    } catch(e) { showToast('Database error: ' + e.message, 'danger'); }
}

async function deleteHotelRoom(id) {
    if (!confirm('Delete this hotel room?')) return;
    try {
        await store.fetchAPI(`/hotel-rooms/${id}`, { method: 'DELETE' });
        await store.refreshData();
        showToast('Hotel Room deleted ✓', 'success');
    } catch(e) { showToast('Failed to delete: ' + e.message, 'danger'); }
}


function renderHotelBookings(container) {
    container.innerHTML = `<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2>Hotel Bookings</h2>
        <button class="btn btn-primary" id="addHotelBookingBtn"><i class="fa-solid fa-plus"></i> New Hotel Booking</button>
    </div>
    <div class="card" style="padding: 20px;">
        <table style="width:100%; border-collapse: collapse; text-align: left;">
            <thead>
                <tr style="border-bottom: 2px solid var(--border-color);">
                    <th style="padding: 12px;">Booking No</th>
                    <th style="padding: 12px;">Customer</th>
                    <th style="padding: 12px;">Room</th>
                    <th style="padding: 12px;">Dates</th>
                    <th style="padding: 12px;">Status</th>
                    <th style="padding: 12px;">Total (Rs.)</th>
                    <th style="padding: 12px;">Actions</th>
                </tr>
            </thead>
            <tbody id="hotelBookingsTableBody">
                <tr><td colspan="7" style="text-align:center; padding: 20px;">Loading...</td></tr>
            </tbody>
        </table>
    </div>`;

    const renderTable = () => {
        const tbody = document.getElementById('hotelBookingsTableBody');
        if (!tbody) return;
        const bookings = store.data.hotelBookings || [];
        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No hotel bookings found.</td></tr>';
            return;
        }

        tbody.innerHTML = bookings.map(b => {
            const room = (store.data.hotelRooms || []).find(r => r.id == b.hotel_room_id);
            const roomName = room ? (room.room_number + ' - ' + room.room_type) : 'Unknown';
            return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px;">${b.booking_no || 'N/A'}</td>
                <td style="padding: 12px;">${b.customer_name}<br><small style="color:var(--text-muted)">${b.customer_phone}</small></td>
                <td style="padding: 12px;">${roomName}</td>
                <td style="padding: 12px;">${b.check_in_date} to ${b.check_out_date}</td>
                <td style="padding: 12px;">${b.status}</td>
                <td style="padding: 12px;">${(b.total_price || 0).toFixed(2)}</td>
                <td style="padding: 12px;">
                    <button class="btn btn-outline btn-sm edit-hb-btn" data-id="${b.id}">Edit</button>
                    <button class="btn btn-outline btn-sm checkout-hb-btn" data-id="${b.id}" style="border-color:#10b981; color:#10b981; margin-left:5px;"><i class="fa-solid fa-file-invoice"></i> Checkout</button>
                </td>
            </tr>
            `;
        }).join('');

        document.querySelectorAll('.edit-hb-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                openHotelBookingModal(id);
            });
        });

        document.querySelectorAll('.checkout-hb-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').getAttribute('data-id');
                checkoutHotelBooking(id);
            });
        });
    };

    renderTable();
    window.addEventListener('store_updated', renderTable);

    document.getElementById('addHotelBookingBtn').addEventListener('click', () => {
        openHotelBookingModal();
    });
}

async function openHotelBookingModal(id = null) {
    const modal = document.getElementById('hotelBookingModal');
    const form = document.getElementById('hotelBookingForm');
    form.reset();
    document.getElementById('hbId').value = '';
    document.getElementById('hbBookingNo').value = 'HB-' + Math.floor(1000 + Math.random() * 9000);
    
    let availableRooms = (store.data.hotelRooms || []).filter(r => r.status === 'Available');
    if (id) {
        const booking = store.data.hotelBookings.find(b => b.id == id);
        if (booking) {
            const currentRoom = (store.data.hotelRooms || []).find(r => r.id == booking.hotel_room_id);
            if (currentRoom && currentRoom.status !== 'Available') {
                availableRooms.push(currentRoom);
            }
        }
    }

    // Populate rooms
    const roomSelect = document.getElementById('hbRoom');
    roomSelect.innerHTML = '<option value="">Select Room</option>' + availableRooms.map(r => 
        `<option value="${r.id}">${r.room_number} (${r.room_type})</option>`
    ).join('');

    const billsTabBtn = document.getElementById('hotelBillsTabBtn');
    const billsList = document.getElementById('hotelRestaurantBillsList');
    const posTotal = document.getElementById('hbPosTotal');

    if (id) {
        document.getElementById('hotelBookingModalTitle').textContent = 'Edit Hotel Booking';
        const booking = store.data.hotelBookings.find(b => b.id == id);
        if (booking) {
            document.getElementById('hbId').value = booking.id;
            document.getElementById('hbBookingNo').value = booking.booking_no;
            document.getElementById('hbCustomerName').value = booking.customer_name;
            document.getElementById('hbCustomerPhone').value = booking.customer_phone;
            document.getElementById('hbRoom').value = booking.hotel_room_id;
            document.getElementById('hbNumGuests').value = booking.num_guests;
            document.getElementById('hbCheckIn').value = booking.check_in_date;
            document.getElementById('hbCheckOut').value = booking.check_out_date;
            document.getElementById('hbStatus').value = booking.status;
            document.getElementById('hbTotalPrice').value = booking.total_price;
        }
        billsTabBtn.style.display = 'block';

        try {
            const res = await store.fetchAPI(`/api/hotel-reservations/${id}/orders`);
            const orders = await res.json();
            if (orders && orders.length > 0) {
                let total = 0;
                billsList.innerHTML = orders.map(o => {
                    total += o.total;
                    return `
                        <div style="border:1px solid var(--border-color); padding:10px; border-radius:6px; margin-bottom:10px;">
                            <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:8px;">
                                <span>Order #${o.id} - ${o.date.split('T')[0]}</span>
                                <span>Rs. ${o.total.toFixed(2)}</span>
                            </div>
                            <div style="font-size:13px; color:var(--text-muted);">
                                ${(o.items || []).map(i => `${i.qty}x ${i.name}`).join(', ')}
                            </div>
                        </div>
                    `;
                }).join('');
                posTotal.textContent = `Rs. ${total.toFixed(2)}`;
            } else {
                billsList.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">No restaurant bills found for this room.</div>';
                posTotal.textContent = 'Rs. 0.00';
            }
        } catch (err) {
            billsList.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Failed to load bills.</div>';
        }
    } else {
        document.getElementById('hotelBookingModalTitle').textContent = 'New Hotel Booking';
        billsTabBtn.style.display = 'none';
    }

    document.querySelectorAll('.res-tab-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.res-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.res-tab-content').forEach(c => c.style.display = 'none');
            newBtn.classList.add('active');
            document.getElementById(newBtn.getAttribute('data-target')).style.display = 'block';
        });
    });
    
    document.querySelector('[data-target="hotel-tab-general"]').click();

    modal.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
    const hotelBookingForm = document.getElementById('hotelBookingForm');
    if(hotelBookingForm) {
        hotelBookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('hbId').value;
            const payload = {
                booking_no: document.getElementById('hbBookingNo').value,
                customer_name: document.getElementById('hbCustomerName').value,
                customer_phone: document.getElementById('hbCustomerPhone').value,
                hotel_room_id: document.getElementById('hbRoom').value,
                num_guests: document.getElementById('hbNumGuests').value,
                check_in_date: document.getElementById('hbCheckIn').value,
                check_out_date: document.getElementById('hbCheckOut').value,
                status: document.getElementById('hbStatus').value,
                total_price: document.getElementById('hbTotalPrice').value
            };

            try {
                const res = await store.fetchAPI(id ? `/api/hotel-reservations/${id}` : '/api/hotel-reservations', {
                    method: id ? 'PUT' : 'POST',
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error("Failed to save booking");
                showToast("Booking saved successfully!", "success");
                document.getElementById('hotelBookingModal').style.display = 'none';
                await store.refreshData();
            } catch (err) {
                showToast(err.message, "error");
            }
        });

        document.getElementById('closeHotelBookingModal').addEventListener('click', () => {
            document.getElementById('hotelBookingModal').style.display = 'none';
        });
    }
});


async function checkoutHotelBooking(id) {
    const booking = store.data.hotelBookings.find(b => b.id == id);
    if (!booking) return showToast("Booking not found", "error");

    const room = (store.data.hotelRooms || []).find(r => r.id == booking.hotel_room_id);
    const roomName = room ? (room.room_number + ' - ' + room.room_type) : 'Unknown';

    document.getElementById('hchk_customer').textContent = booking.customer_name;
    document.getElementById('hchk_booking_no').textContent = booking.booking_no;
    document.getElementById('hchk_status').textContent = booking.status;
    if (booking.status === 'Checked Out' || booking.status === 'Completed') {
        document.getElementById('hchk_status').style.color = '#10b981';
        document.getElementById('markHotelPaidBtn').style.display = 'none';
    } else {
        document.getElementById('hchk_status').style.color = '#000';
        document.getElementById('markHotelPaidBtn').style.display = 'inline-block';
        document.getElementById('markHotelPaidBtn').onclick = () => finalizeHotelCheckout(id);
    }
    
    document.getElementById('hchk_room').textContent = roomName;
    document.getElementById('hchk_dates').textContent = booking.check_in_date + ' to ' + booking.check_out_date;

    let itemsHtml = `<tr><td style="padding:8px 0;">Hotel Room Accommodation</td><td style="padding:8px 0; text-align:right;">Rs. ${(booking.total_price || 0).toFixed(2)}</td></tr>`;
    
    let posTotal = 0;
    try {
        const res = await store.fetchAPI(`/api/hotel-reservations/${id}/orders`);
        const orders = await res.json();
        if (orders && orders.length > 0) {
            orders.forEach(o => {
                posTotal += o.total;
                itemsHtml += `<tr>
                    <td style="padding:8px 0; color:#555;">
                        <small>Restaurant Order #${o.id} (${o.date.split('T')[0]})</small><br>
                        <small style="color:#888;">${(o.items || []).map(i => i.qty + 'x ' + i.name).join(', ')}</small>
                    </td>
                    <td style="padding:8px 0; text-align:right; color:#555;">Rs. ${o.total.toFixed(2)}</td>
                </tr>`;
            });
        }
    } catch (err) {
        console.error('Error fetching POS orders for checkout', err);
    }

    document.getElementById('hchk_items_body').innerHTML = itemsHtml;
    
    document.getElementById('hchk_room_total').textContent = `Rs. ${(booking.total_price || 0).toFixed(2)}`;
    document.getElementById('hchk_pos_total').textContent = `Rs. ${posTotal.toFixed(2)}`;
    
    const grandTotal = (parseFloat(booking.total_price) || 0) + posTotal;
    document.getElementById('hchk_grand_total').textContent = `Rs. ${grandTotal.toFixed(2)}`;

    document.getElementById('hotelCheckoutModal').style.display = 'flex';
}

async function finalizeHotelCheckout(id) {
    if (!confirm('Are you sure you want to mark this booking as Checked Out?')) return;
    
    try {
        // Fetch current booking to do a full PUT
        const booking = store.data.hotelBookings.find(b => b.id == id);
        booking.status = 'Checked Out';
        
        const res = await store.fetchAPI(`/api/hotel-reservations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(booking)
        });
        
        if (!res.ok) throw new Error("Failed to checkout");
        
        showToast('Booking Checked Out Successfully!', 'success');
        document.getElementById('hchk_status').textContent = 'Checked Out';
        document.getElementById('hchk_status').style.color = '#10b981';
        document.getElementById('markHotelPaidBtn').style.display = 'none';
        
        await store.refreshData();
    } catch (err) {
        showToast('Error finalizing checkout: ' + err.message, 'error');
    }
}

function printHotelCheckoutInvoice() {
    const printContent = document.getElementById('hotelCheckoutPrintArea').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    
    // reload slightly to ensure events bind back if needed, or close modal
    location.reload();
}
