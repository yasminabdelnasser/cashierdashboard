let orders = [];
let fullMenu = []; 
let currentTab = 'active';

let isUpdating = false; 
let lastActionTime = 0; 
let knownOrderIds = new Set(); 

let currentEditTax = 0;
let currentEditDelivery = 0;
let currentEditDiscount = 0;
let currentPaymentOrderTotal = 0; 

const editModal = document.getElementById('editModal');
let editId = null;
const modal = document.getElementById('paymentModal');
let payId = null; 
const confirmModal = document.getElementById('confirmModal');
let confirmId = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchOrdersFromDB(); 
    fetchMenuFromDB(); 
    updateStats(); 
    
    if(localStorage.getItem('openPaymentTab') === 'true') {
        switchTab('payment');
        localStorage.removeItem('openPaymentTab'); 
    } else {
        switchTab('active'); 
    }
    
    setInterval(() => {
        fetchOrdersFromDB();
        updateStats();
    }, 5000);

    // 🚀 --- نظام التحميل الأوتوماتيكي الذكي (الرادار) --- 🚀
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 2 && now.getMinutes() === 58) {
            const todayStr = now.toLocaleDateString('en-US');
            if (localStorage.getItem('lastAutoDownload') !== todayStr) {
                localStorage.setItem('lastAutoDownload', todayStr);
                fetch('/api/get_order_history')
                    .then(response => response.json())
                    .then(data => {
                        let csv = 'Order ID,Customer Name,Order Type,Items Details,Time,Amount,Status\n';
                        (data.history || []).forEach(order => {
                            const itemsSummary = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(' + ');
                            csv += `"#${order.id}","${(order.customer || '').replace(/"/g, '""')}","${order.type}","${itemsSummary.replace(/"/g, '""')}","${order.time}","${order.total} EGP","Completed"\n`;
                        });
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = window.URL.createObjectURL(blob);
                        link.download = `AKLTECH_Daily_Sales_${todayStr.replace(/\//g, '-')}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => window.location.reload(), 60000);
                    }).catch(e => console.error("Backup Error:", e));
            }
        }
    }, 1000);

    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString('en-US', options);

    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.add('light-mode');
        if(themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
    }

    if(themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('light-mode');
            if (document.documentElement.classList.contains('light-mode')) {
                localStorage.setItem('theme', 'light');
                themeIcon.classList.replace('fa-sun', 'fa-moon');
            } else {
                localStorage.setItem('theme', 'dark');
                themeIcon.classList.replace('fa-moon', 'fa-sun');
            }
        });
    }
});

function goToDashboard() {
    if (window.location.pathname.includes('/dashboard') || window.location.pathname === '/') {
        switchTab('active');
    } else { window.location.href = '/dashboard'; }
}

function goToPayment() {
    if (window.location.pathname.includes('/dashboard') || window.location.pathname === '/') {
        switchTab('payment');
    } else {
        localStorage.setItem('openPaymentTab', 'true');
        window.location.href = '/dashboard';
    }
}

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) { console.log("Audio not allowed yet by browser"); }
}

async function fetchOrdersFromDB() {
    if (isUpdating) return; 
    const fetchStartTime = Date.now(); 
    try {
        const response = await fetch(`/api/get_active_orders?t=${new Date().getTime()}`);
        const data = await response.json();
        if (isUpdating || lastActionTime > fetchStartTime) return; 
        
        let hasNewOrder = false;
        data.orders.forEach(o => {
            if (o.status === 'new' && !knownOrderIds.has(o.id)) hasNewOrder = true; 
            knownOrderIds.add(o.id);
        });

        if (hasNewOrder) playNotificationSound(); 
        
        const dataString = JSON.stringify(data.orders);
        if (JSON.stringify(orders) !== dataString) {
            orders = data.orders;
            renderOrders();
        }
    } catch (error) { console.error("Error fetching orders:", error); }
}

async function fetchMenuFromDB() {
    try {
        const response = await fetch('/api/get_menu');
        const data = await response.json();
        fullMenu = data.menu || [];
    } catch (e) { console.error("Error fetching menu:", e); }
}

async function updateStats() {
    try {
        const response = await fetch(`/api/dashboard-stats?t=${new Date().getTime()}`);
        const stats = await response.json();
        const ids = {new:'count-new', preparing:'count-preparing', ready:'count-ready', payment:'count-payment', completed:'count-completed'};
        for(const [status, id] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (el) el.innerText = stats[status] || 0;
        }
    } catch (e) { console.error("Stats update error:", e); }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) sidebar.classList.toggle('active');
    else sidebar.classList.toggle('hidden');
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));

    if (tabName === 'active') {
        const navDash = document.getElementById('nav-dashboard');
        if(navDash) navDash.classList.add('active');
        document.getElementById('page-title').innerText = "Dashboard Overview";
    } else if (tabName === 'payment') {
        const navPay = document.getElementById('nav-payment');
        if(navPay) navPay.classList.add('active');
        document.getElementById('page-title').innerText = "Pending Payments";
    }

    const activeTabBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => 
        b.innerText.toLowerCase().includes(tabName)
    );
    if(activeTabBtn) activeTabBtn.classList.add('active');
    renderOrders();
}

function renderOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;
    container.innerHTML = ''; 

    const filteredOrders = orders.filter(order => {
        const status = (order.status || "").toLowerCase().trim();
        if (currentTab === 'active') return ['new', 'confirmed', 'preparing', 'ready'].includes(status);
        if (currentTab === 'payment') return status === 'payment';
        return false;
    });

    if (filteredOrders.length === 0) {
        container.innerHTML = `<div style="text-align:center; grid-column:1/-1; padding:40px; color:var(--text-muted);">No orders found.</div>`;
        return;
    }

    filteredOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card'; 
        
        let badgeStyle = '';
        let actionButtonsHtml = '';
        let typeBadgeHtml = '';
        const status = (order.status || "").toLowerCase().trim();
        const typeStr = (order.order_type || "").toLowerCase().trim();

        let deliveryInfo = '';
        let reservationInfo = '';

        if (typeStr.includes('delivery')) {
            typeBadgeHtml = `<span class="badge-type" style="background: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid #db2777;">Delivery</span>`;
            deliveryInfo = `<div style="font-size:0.75rem; color:#f472b6; margin-bottom:8px; line-height:1.4;">
                <i class="fa-solid fa-map-location-dot"></i> ${order.address || 'No Address'}<br>
                <i class="fa-solid fa-phone"></i> ${order.phone || 'No Phone'}
            </div>`;
        } 
        else if (typeStr.includes('reservation')) {
            typeBadgeHtml = `<span class="badge-type res-badge">Reservation</span>`;
            if (order.reserve_time) {
                reservationInfo = `<div style="font-size:0.75rem; color:var(--info-text); margin-bottom:8px; display:flex; gap:10px;">
                    <span><i class="fa-regular fa-calendar"></i> ${order.reserve_time}</span>
                    <span><i class="fa-solid fa-users"></i> ${order.party_size} Pax</span>
                </div>`;
            }
        } 
        else if (typeStr.includes('take') || !order.table_id || order.table_id === 'null' || order.table_id === 'None') {
            typeBadgeHtml = `<span class="badge-type take-badge">Takeaway</span>`;
        } 
        else {
            typeBadgeHtml = `<span class="badge-type dine-badge">Dine-in</span>`;
        }

        let cancelBtnHtml = `<button class="action-btn cancel-sm-btn" style="flex: 0.4;" onclick="updateStatus('${order.id}', 'cancelled')">Cancel</button>`;

        if (status === 'new' || status === '') {
            badgeStyle = 'background:var(--info-bg); color:var(--info-text)';
            actionButtonsHtml = `
                <div style="display:flex; gap:8px;">
                    <button class="action-btn secondary-action" style="flex: 1; background:var(--bg-body); border:1px solid var(--border-color); color:var(--text-main); margin-top: 6px;" onclick="openEditModal('${order.id}')">Edit Items</button>
                    ${cancelBtnHtml}
                </div>
                <button class="action-btn confirm" onclick="updateStatus('${order.id}', 'confirmed')">Confirm Order</button>
            `;
        }  else if (status === 'confirmed') {
            badgeStyle = 'background:var(--confirmed-bg); color:var(--confirmed-text);'; 
            actionButtonsHtml = `
                <div style="display:flex; gap:8px;">
                    <button class="action-btn secondary-action" style="flex: 1; background:var(--bg-body); border:1px solid var(--border-color); color:var(--text-main); margin-top: 6px;" onclick="openEditModal('${order.id}')">Edit Items</button>
                    ${cancelBtnHtml}
                </div>
                <button class="action-btn pay" style="background:var(--info-text); color:#fff;" onclick="openConfirmModal('${order.id}')">Go To Kitchen</button>
            `;
        } else if (status === 'preparing') {
            badgeStyle = 'background:var(--warning-bg); color:var(--warning-text)';
            actionButtonsHtml = `<button class="action-btn pay" style="background:var(--success-text); color:#fff;" onclick="updateStatus('${order.id}', 'ready')">Mark Ready</button>`;
        } else if (status === 'ready') {
            badgeStyle = 'background:var(--success-bg); color:var(--success-text)';
            actionButtonsHtml = `<button class="action-btn pay" style="background:var(--primary); color:var(--primary-text);" onclick="updateStatus('${order.id}', 'payment')">Send to Payment</button>`;
        } else if (status === 'payment') {
            badgeStyle = 'background:var(--danger-bg); color:var(--danger-text)';
            actionButtonsHtml = `<button class="action-btn pay" onclick="openPaymentModal('${order.id}')">Process Payment</button>`;
        }

        const displayTitle = order.table_id && order.table_id !== "NULL" && order.table_id !== "None"
            ? `${order.customer} - Table #${order.table_id}` : order.customer;

        let itemsHtml = (order.items || []).map(item => `
            <div style="margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem; color:var(--text-muted)">
                    <span>${item.name} (x${item.quantity || 1})</span>
                    <span style="color:var(--primary)">${item.price ? parseFloat(item.price).toFixed(2) : '0.00'}</span>
                </div>
                ${item.item_notes ? `<div style="font-size:0.7rem; color:var(--danger-text); margin-left:10px;">- ${item.item_notes}</div>` : ''}
            </div>
        `).join('');

        let notesHtml = '';
        if (order.notes && order.notes.trim() !== '' && order.notes.toLowerCase() !== 'null') {
            notesHtml = `
            <div style="padding: 10px 0; border-top: 1px dashed var(--border-color); margin-top: 5px; font-size: 0.8rem; color: var(--text-muted); font-style: italic;">
                <span style="color:var(--warning-text); font-weight:bold;"><i class="fa-solid fa-note-sticky"></i> Note:</span> ${order.notes}
            </div>`;
        }

        let prepTimeHtml = '';
        if (status === 'preparing' && order.prepTime) {
            prepTimeHtml = `<p style="font-size:0.8rem; color:var(--warning-text); margin-bottom: 8px; font-weight: bold; background: var(--warning-bg); padding: 5px 10px; border-radius: 6px; display: inline-block;"><i class="fa-regular fa-clock"></i> Ready by: ${order.prepTime}</p>`;
        }

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:12px; align-items:center;">
                <div>
                    <span style="font-weight:bold; color:var(--primary); font-size:1.1rem; margin-right:8px;">#${order.id}</span>
                    ${typeBadgeHtml}
                </div>
                <span style="padding:4px 10px;border-radius:20px;font-size:0.7rem;font-weight:bold;${badgeStyle}">${order.status.toUpperCase()}</span>
            </div>
            <h4 style="margin:0 0 5px 0; color:var(--text-main); font-size:1.05rem;">${displayTitle}</h4>
            ${deliveryInfo}
            ${reservationInfo}
            <div class="order-items-wrapper">${itemsHtml}</div>
            ${notesHtml}
            <div class="order-actions-area">
                <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1rem; border-top: 1px solid var(--border-color); color:var(--text-main); padding-top: 10px; margin-bottom: 8px;">
                    <span>Total</span><span>${parseFloat(order.total).toFixed(2)} EGP</span>
                </div>
                ${prepTimeHtml}
                ${actionButtonsHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

function updateStatus(id, newStatus) {
    isUpdating = true; lastActionTime = Date.now(); 
    const orderIndex = orders.findIndex(o => String(o.id) === String(id));
    if (orderIndex > -1) {
        orders[orderIndex].status = newStatus;
        renderOrders(); 
        updateStats(); 
    }

    fetch('/api/update_order_status', { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ id: id, status: newStatus }) 
    })
    .then(() => {
        setTimeout(() => { isUpdating = false; fetchOrdersFromDB(); updateStats(); }, 600);
    })
    .catch(e => { console.error("Status update failed:", e); isUpdating = false; });
}

// 🖨️ طباعة المطبخ
function printKitchenReceipt(order) {
    const win = window.open('', '', 'height=600,width=400');
    const items = order.items || [];
    let notesHtml = '';
    if (order.notes && order.notes.trim() !== '' && order.notes.toLowerCase() !== 'null') {
        notesHtml = `<div class="order-notes">Order Notes:<br><span style="font-weight:normal; font-style:italic;">${order.notes}</span></div>`;
    }
    let prepTimeHtml = order.prepTime ? `<p style="font-size:16px; font-weight:bold; border:1px solid #000; padding:4px; display:inline-block;">Ready By: ${order.prepTime}</p>` : '';

    win.document.write(`<html><head><title>Kitchen Ticket #${order.id}</title><style>body { font-family: sans-serif; padding: 15px; font-size: 16px; } h2 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; } p { margin: 4px 0; } .item { font-weight: bold; margin-top: 10px; font-size: 18px; } .item-note { font-size: 14px; color: #333; margin-left: 15px; font-style: italic; } .order-notes { border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px; font-weight: bold; }</style></head><body>`);
    win.document.write(`<h2>KITCHEN TICKET</h2>`);
    win.document.write(`<p style="font-size:18px;"><b>Order ID:</b> #${order.id}</p>`);
    win.document.write(`<p><b>Type:</b> ${order.order_type}</p>`);
    if (order.table_id && order.table_id !== 'NULL' && order.table_id !== 'None') {
        win.document.write(`<p style="font-size:18px;"><b>Table:</b> #${order.table_id}</p>`);
    }
    win.document.write(prepTimeHtml);
    win.document.write(`<hr>`);
    items.forEach(i => {
        win.document.write(`<div class="item">- ${i.name} (x${i.quantity})</div>`);
        if (i.item_notes) win.document.write(`<div class="item-note">* ${i.item_notes}</div>`);
    });
    win.document.write(notesHtml);
    win.document.write(`</body></html>`);
    win.document.close();
    win.print();
}

// 🖨️ طباعة العميل (تطبع النسبة المئوية للخصم)
function printCustomerReceipt(order) {
    const win = window.open('', '', 'height=600,width=400');
    const items = order.items || [];
    const cashierNameElement = document.getElementById('user-name-display');
    const cashierName = cashierNameElement ? cashierNameElement.innerText : (order.cashier || 'Cashier');

    win.document.write(`<html><head><title>Receipt #${order.id}</title><style>body { font-family: sans-serif; padding: 20px; font-size: 13px; } h2 { text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; } p { margin: 4px 0; } .total { font-weight: bold; font-size: 16px; border-top: 2px dashed #000; margin-top: 10px; padding-top: 10px; display: flex; justify-content: space-between; } .sub-calc { display: flex; justify-content: space-between; margin: 3px 0; color: #444; }</style></head><body>`);
    win.document.write(`<h2>AKLTECH Receipt</h2>`);
    win.document.write(`<p><b>Order ID:</b> #${order.id}</p>`);
    win.document.write(`<p><b>Customer:</b> ${order.customer}</p>`);
    win.document.write(`<p><b>Cashier:</b> ${cashierName}</p>`);
    win.document.write(`<p><b>Date:</b> ${new Date().toLocaleString()}</p>`);
    win.document.write(`<hr>`);
    items.forEach(i => win.document.write(`<div style="display:flex; justify-content:space-between; margin-bottom:6px;"><p style="margin:0;">${i.name} (x${i.quantity})</p><p style="margin:0;">${i.price} EGP</p></div>`));
    win.document.write(`<hr style="border-top: 1px dashed #000;">`);
    
    let subtotal = items.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity)), 0);
    win.document.write(`<div class="sub-calc"><span>Subtotal:</span><span>${subtotal.toFixed(2)} EGP</span></div>`);
    
    if (order.tax > 0) win.document.write(`<div class="sub-calc"><span>Tax:</span><span>+${parseFloat(order.tax).toFixed(2)} EGP</span></div>`);
    if (order.delivery_fee > 0) win.document.write(`<div class="sub-calc"><span>Delivery Fee:</span><span>+${parseFloat(order.delivery_fee).toFixed(2)} EGP</span></div>`);
    
    // إظهار الخصم والنسبة لو في خصم
    if (order.discount_amount > 0) {
        let percStr = order.discount_percentage ? ` (${order.discount_percentage}%)` : '';
        win.document.write(`<div class="sub-calc"><span>Discount${percStr}:</span><span>-${parseFloat(order.discount_amount).toFixed(2)} EGP</span></div>`);
    }

    win.document.write(`<div class="total"><span>TOTAL:</span><span>${parseFloat(order.total).toFixed(2)} EGP</span></div>`);
    win.document.write(`<p style="text-align:center; margin-top: 25px; font-weight: bold; font-size:14px;">Thank you for your visit!</p>`);
    win.document.write(`</body></html>`);
    win.document.close();
    win.print();
}

// 🌟 نافذة الدفع (بنسبة الخصم المئوية) 🌟
function openPaymentModal(id) {
    payId = id;
    const order = orders.find(o => String(o.id) === String(id));
    if (!order) return;
    
    let baseTotal = order.items.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity)), 0);
    baseTotal += parseFloat(order.tax || 0) + parseFloat(order.delivery_fee || 0);
    currentPaymentOrderTotal = baseTotal;

    document.getElementById('modalOrderId').innerText = id;
    document.getElementById('modalCustomerName').innerText = order.customer;
    
    const discInput = document.getElementById('paymentDiscountInput');
    if(discInput) {
        // تحويل قيمة الخصم القديمة لنسبة مئوية للعرض لو موجودة
        if(order.discount_amount > 0 && baseTotal > 0) {
            discInput.value = Math.round((parseFloat(order.discount_amount) / baseTotal) * 100);
        } else {
            discInput.value = 0;
        }
    }
    
    updatePaymentTotal(); 

    document.getElementById('clientPaymentMethodDisplay').innerText = order.payment_method || 'Cash';
    document.getElementById('modalItemsContainer').innerHTML = order.items.map(i => `
        <div style="display:flex;justify-content:space-between; margin-bottom:5px; color:var(--text-main);">
            <span>${i.name} (x${i.quantity || 1})</span>
            <span>${i.price ? parseFloat(i.price).toFixed(2) : '0.00'} EGP</span>
        </div>
    `).join('');
    modal.style.display = 'flex';
    
    const confirmBtn = document.getElementById('confirmPaymentBtn');
    if (confirmBtn) { 
        confirmBtn.onclick = () => { 
            const discPercent = parseFloat(document.getElementById('paymentDiscountInput').value) || 0;
            // حساب قيمة الخصم بالفلوس عشان تتبعت للداتا بيز
            const finalDiscountAmount = currentPaymentOrderTotal * (discPercent / 100);
            
            order.discount_percentage = discPercent; // تخزين النسبة عشان نطبعها
            order.discount_amount = finalDiscountAmount; 
            order.total = currentPaymentOrderTotal - finalDiscountAmount; 
            if (order.total < 0) order.total = 0;

            printCustomerReceipt(order); 
            updateStatusWithPayment(id, 'completed', finalDiscountAmount, order.total); 
            closePaymentModal(); 
        }; 
    }
}

// تحديث الإجمالي اللحظي مع كتابة النسبة
function updatePaymentTotal() {
    const discInput = document.getElementById('paymentDiscountInput');
    const discPercent = parseFloat(discInput ? discInput.value : 0) || 0;
    
    const discountAmount = currentPaymentOrderTotal * (discPercent / 100);
    
    let finalTotal = currentPaymentOrderTotal - discountAmount;
    if(finalTotal < 0) finalTotal = 0;
    document.getElementById('modalTotalAmount').innerText = finalTotal.toFixed(2) + ' EGP';
}

function updateStatusWithPayment(id, newStatus, discount, finalTotal) {
    isUpdating = true; lastActionTime = Date.now(); 
    const orderIndex = orders.findIndex(o => String(o.id) === String(id));
    if (orderIndex > -1) {
        orders[orderIndex].status = newStatus;
        orders[orderIndex].discount_amount = discount;
        orders[orderIndex].total = finalTotal;
        renderOrders(); updateStats();
    }
    fetch('/api/update_order_status', { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ id: id, status: newStatus, discount: discount, finalTotal: finalTotal }) 
    }).then(() => { setTimeout(() => { isUpdating = false; fetchOrdersFromDB(); updateStats(); }, 600); })
    .catch(e => { console.error("Update failed:", e); isUpdating = false; });
}
function closePaymentModal() { modal.style.display = 'none'; }


function openConfirmModal(id) {
    confirmId = id;
    document.getElementById('confirmModalOrderId').innerText = id;
    document.getElementById('prepTimeInput').value = 15; 
    confirmModal.style.display = 'flex';
}
function closeConfirmModal() { confirmModal.style.display = 'none'; confirmId = null; }

function processConfirmation() {
    if (!confirmId) return;
    const prepTimeInput = document.getElementById('prepTimeInput');
    const prepTime = prepTimeInput ? prepTimeInput.value : 15;
    
    const idToUpdate = confirmId;
    const orderIndex = orders.findIndex(o => String(o.id) === String(idToUpdate));
    
    closeConfirmModal();
    isUpdating = true; lastActionTime = Date.now(); 

    if (orderIndex > -1) {
        orders[orderIndex].status = 'preparing';
        let d = new Date(); d.setMinutes(d.getMinutes() + parseInt(prepTime));
        orders[orderIndex].prepTime = d.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
        renderOrders(); updateStats(); 
        
        setTimeout(() => { printKitchenReceipt(orders[orderIndex]); }, 500);
    }
    
    fetch('/api/update_order_status', { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ id: idToUpdate, status: 'preparing', prepTime: prepTime }) 
    }).then(() => { setTimeout(() => { isUpdating = false; fetchOrdersFromDB(); updateStats(); }, 600); })
    .catch(e => { console.error("Confirmation error:", e); isUpdating = false; });
}

// 🌟 نافذة التعديل (فيها الدليفري) 🌟
function openEditModal(id) {
    editId = id;
    const order = orders.find(o => String(o.id) === String(id));
    if (!order) return;
    
    currentEditTax = parseFloat(order.tax) || 0;
    currentEditDelivery = parseFloat(order.delivery_fee) || 0;
    currentEditDiscount = parseFloat(order.discount_amount) || 0;

    document.getElementById('editModalOrderId').innerText = id;
    document.getElementById('editCustomerNameDisplay').innerText = order.customer; 
    const itemsContainer = document.getElementById('editItemsContainer');
    
    let itemsHtml = (order.items || []).map(item => `
        <div class="edit-item-row" data-item-id="${item.item_id}" style="padding: 15px; border: 1px solid var(--border-color); background: var(--bg-body); border-radius: 8px; margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                <i class="fa-solid fa-trash" onclick="this.closest('.edit-item-row').remove(); updateDynamicTotal();" style="cursor:pointer; color:var(--danger-text); font-size:1.1rem; transition:0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></i>
                <span style="font-weight:bold; color:var(--text-main); font-size:1rem;">${item.name}</span>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:12px; align-items:center;">
                <input type="number" class="edit-item-qty" value="${item.quantity}" oninput="updateDynamicTotal()" min="1" style="width:60px; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); padding:6px; border-radius:6px; text-align:center; font-size:0.9rem;">
                <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">:Qty</span>
                <input type="number" step="0.01" class="edit-item-price" value="${item.price}" oninput="updateDynamicTotal()" style="width:80px; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); padding:6px; border-radius:6px; text-align:center; font-size:0.9rem;">
                <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">:Price</span>
            </div>
        </div>
    `).join(''); 
    
    // إظهار التوصيل للديليفري فقط
    let deliveryHtml = '';
    const typeStr = (order.order_type || "").toLowerCase().trim();
    if (typeStr.includes('delivery')) {
        deliveryHtml = `
            <div style="margin-top:15px; display:flex; justify-content:space-between; align-items:center; background:var(--bg-body); padding:10px; border-radius:8px; border:1px dashed var(--info-text);">
                <span style="color:var(--text-main); font-weight:bold;"><i class="fa-solid fa-motorcycle" style="color:var(--info-text);"></i> Delivery Fee</span>
                <input type="number" id="editDeliveryFeeInput" value="${currentEditDelivery}" min="0" oninput="updateDynamicTotal()" style="width:80px; text-align:center; padding:6px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-main); font-weight:bold;">
            </div>
        `;
    }
    
    itemsHtml += `
        ${deliveryHtml}
        <div id="addBtnContainer" style="text-align:center; margin-top:15px;">
            <button type="button" class="action-btn" style="background:var(--primary); color:var(--primary-text); width:100%; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer;" onclick="addNewItemRow()">+ Add New Item</button>
        </div>
    `;
    
    itemsContainer.innerHTML = itemsHtml;
    updateDynamicTotal();
    editModal.style.display = 'flex';
}

function updateDynamicTotal() {
    const itemsContainer = document.getElementById('editItemsContainer');
    if (!itemsContainer) return;
    
    let subtotal = 0;
    itemsContainer.querySelectorAll('.edit-item-row').forEach(row => {
        const price = parseFloat(row.querySelector('.edit-item-price').value) || 0;
        const quantity = parseInt(row.querySelector('.edit-item-qty').value) || 0;
        subtotal += (price * quantity);
    });
    
    const deliveryInput = document.getElementById('editDeliveryFeeInput');
    if (deliveryInput) {
        currentEditDelivery = parseFloat(deliveryInput.value) || 0;
    }

    let grandTotal = subtotal + currentEditTax + currentEditDelivery - currentEditDiscount;
    if(grandTotal < 0) grandTotal = 0;

    const totalEl = document.getElementById('editDynamicTotal');
    if (totalEl) {
        totalEl.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal; margin-bottom: 5px;">
                Subtotal: ${subtotal.toFixed(2)} | Tax: +${currentEditTax.toFixed(2)} | Fee: +${currentEditDelivery.toFixed(2)} | Disc: -${currentEditDiscount.toFixed(2)}
            </div>
            <span style="color:var(--primary); font-size: 1.3rem;">${grandTotal.toFixed(2)} EGP</span>
        `;
        totalEl.setAttribute('data-subtotal', subtotal);
        totalEl.setAttribute('data-total', grandTotal);
    }
}

function addNewItemRow() {
    const itemsContainer = document.getElementById('editItemsContainer');
    const addBtnContainer = document.getElementById('addBtnContainer');
    const row = document.createElement('div');
    row.className = 'edit-item-row'; row.setAttribute('data-item-id', 'new'); 
    row.style.cssText = "padding: 15px; border: 1px dashed var(--primary); background: var(--bg-body); border-radius: 8px; margin-bottom: 12px;";

    let optionsHtml = '<option value="" disabled selected>Select an item...</option>';
    let currentCategory = '';
    fullMenu.forEach(m => {
        let cat = m.category || 'Other';
        if (cat !== currentCategory) {
            if (currentCategory !== '') optionsHtml += '</optgroup>';
            optionsHtml += `<optgroup label="--- ${cat} ---">`;
            currentCategory = cat;
        }
        optionsHtml += `<option value="${m.id}" data-price="${m.price}">${m.name}</option>`;
    });
    if (currentCategory !== '') optionsHtml += '</optgroup>';

    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
            <i class="fa-solid fa-trash" onclick="this.closest('.edit-item-row').remove(); updateDynamicTotal();" style="cursor:pointer; color:var(--danger-text); font-size:1.1rem; transition:0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></i>
            <select class="new-item-select" style="background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); padding:6px; border-radius:6px; width:75%; font-family: 'Cairo', sans-serif;" onchange="updateNewItemPrice(this)">
                ${optionsHtml}
            </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px; align-items:center;">
            <input type="number" class="edit-item-qty" value="1" oninput="updateDynamicTotal()" min="1" style="width:60px; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); padding:6px; border-radius:6px; text-align:center; font-size:0.9rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">:Qty</span>
            <input type="number" step="0.01" class="edit-item-price" value="0" oninput="updateDynamicTotal()" style="width:80px; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); padding:6px; border-radius:6px; text-align:center; font-size:0.9rem;" readonly>
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">:Price</span>
        </div>
    `;
    itemsContainer.insertBefore(row, addBtnContainer);
}

function updateNewItemPrice(selectEl) {
    const row = selectEl.closest('.edit-item-row');
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const price = selectedOption.getAttribute('data-price') || 0;
    row.querySelector('.edit-item-price').value = price;
    updateDynamicTotal();
}
function closeEditModal() { editModal.style.display = 'none'; }

function saveOrderEdit() {
    if (!editId) return;
    const itemsContainer = document.getElementById('editItemsContainer');
    const rows = itemsContainer.querySelectorAll('.edit-item-row');
    let updatedItems = [];
    rows.forEach(row => {
        const itemId = row.getAttribute('data-item-id');
        const price = parseFloat(row.querySelector('.edit-item-price').value) || 0;
        const qty = parseInt(row.querySelector('.edit-item-qty').value) || 0;
        if (itemId === 'new') {
            const selectEl = row.querySelector('.new-item-select');
            if (selectEl && selectEl.value) updatedItems.push({ item_id: 'new', menu_id: parseInt(selectEl.value), price: price, quantity: qty }); 
        } else if (itemId && itemId !== "undefined") {
            updatedItems.push({ item_id: parseInt(itemId), price: price, quantity: qty });
        }
    });

    const totalEl = document.getElementById('editDynamicTotal');
    const newTotal = parseFloat(totalEl.getAttribute('data-total'));
    const saveBtn = document.querySelector('.confirm-btn.pay');
    const originalBtnText = saveBtn ? saveBtn.innerText : "Save Changes";
    if (saveBtn) saveBtn.innerText = "Saving...";

    isUpdating = true; lastActionTime = Date.now();

    fetch('/api/edit_order', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ order_id: parseInt(editId), items: updatedItems, total: newTotal, delivery_fee: currentEditDelivery })
    }).then(async response => {
        if (response.ok) {
            closeEditModal();
            setTimeout(() => { isUpdating = false; fetchOrdersFromDB(); updateStats(); }, 600);
        } else {
            alert("⚠️ Error saving changes!");
            isUpdating = false;
        }
    }).finally(() => { if (saveBtn) saveBtn.innerText = originalBtnText; });
}