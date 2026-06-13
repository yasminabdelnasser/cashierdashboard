const API = "/api"; 
let globalReservations = []; 
let currentSort = { column: null, direction: 'asc' };
let tablesData = [];
let lastReservationsHash = ""; // متغير عشان نحفظ فيه شكل الداتا ونمنع التهنيج
let isFetching = false; // قفل لمنع تداخل الطلبات وتسريع الصفحة

document.addEventListener('DOMContentLoaded', () => {
    loadTables();
    loadReservations();
    
    // التحديث كل 10 ثواني عشان نقلل الضغط على السيرفر ونسرع الصفحة
    setInterval(loadReservations, 10000); 
    
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

    const searchInput = document.getElementById('res-search');
    if(searchInput) searchInput.addEventListener('input', applySearchFilter);

    // تفريغ الهاش لإجبار الرسم من جديد عند تغيير الفلاتر
    ['res-range', 'res-history'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', () => {
            const sDate = document.getElementById('res-start-date');
            const eDate = document.getElementById('res-end-date');
            if (sDate) sDate.value = ''; 
            if (eDate) eDate.value = ''; 
            lastReservationsHash = ""; 
            loadReservations();
        });
    });
    
    // ربط حقلي البداية والنهاية
    ['res-start-date', 'res-end-date'].forEach(id => {
        const dateInput = document.getElementById(id);
        if(dateInput) dateInput.addEventListener('change', () => {
            lastReservationsHash = ""; 
            loadReservations();
        });
    });
    
    const tableModal = document.getElementById('table-modal');
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            tableModal.style.display = 'none';
            document.getElementById('tableStatusModal').style.display = 'none';
        });
    });
    window.addEventListener('click', (e) => { 
        if(e.target === tableModal) tableModal.style.display = 'none'; 
        if(e.target === document.getElementById('tableStatusModal')) document.getElementById('tableStatusModal').style.display = 'none';
    });
});

// ==========================================
// 1. جلب ورسم خريطة الطاولات الـ 3D
// ==========================================
async function loadTables() {
    try {
        const res = await fetch(`${API}/get_tables?t=${new Date().getTime()}`);
        const data = await res.json();
        tablesData = data.tables || [];
        renderTablesMap();
    } catch(err) { console.error("Tables Load Error:", err); }
}

function renderTablesMap() {
    const container = document.getElementById('tables-map');
    if (!container) return;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // نقرأ الفلتر الحالي عشان الخريطة تتجاوب معاه
    const rangeFilter = document.getElementById('res-range')?.value || 'today';

    container.innerHTML = tablesData.map(t => {
        let showDot = false;

        if (rangeFilter === 'cancelled') {
            // لو الفلتر "متكنسل": النقطة هتنور بس للترابيزات اللي ليها حجوزات ملغية
            showDot = globalReservations.some(r => 
                String(r.table_id) === String(t.id) && 
                (r.reservation_status || '').toLowerCase() === 'cancelled'
            );
        } else {
            // الوضع الطبيعي: النقطة هتنور للترابيزات اللي عليها حجز نشط وجاي
            showDot = globalReservations.some(r => 
                String(r.table_id) === String(t.id) && 
                new Date(r.time) >= todayStart && 
                (r.reservation_status || '').toLowerCase() !== 'cancelled'
            );
        }
        
        return `
            <div class="table-block ${showDot ? 'has-reservations' : ''}" onclick="openTableDetails(${t.id}, '${t.name}')">
                <strong>${t.name}</strong>
                <small><i class="fa-solid fa-chair"></i> ${t.seats}</small>
            </div>
        `;
    }).join('');
}

// ==========================================
// 2. نافذة (Modal) تفاصيل الطاولة
// ==========================================
function openTableDetails(tableId, tableName) {
    document.getElementById('modal-table-title').innerHTML = `<i class="fa-solid fa-utensils"></i> Table ${tableName} Bookings`;
    const listContainer = document.getElementById('table-reservations-list');
    
    const now = new Date();
    const tableRes = globalReservations.filter(r => r.table_id == tableId && new Date(r.time) >= new Date(now.setHours(0,0,0,0)) && (r.reservation_status || '').toLowerCase() !== 'cancelled')
        .sort((a,b) => new Date(a.time) - new Date(b.time));

    if (tableRes.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No active upcoming bookings for this table.</div>`;
    } else {
        listContainer.innerHTML = tableRes.map(r => {
            const resDate = new Date(r.time);
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            const dateOptions = { month: 'short', day: 'numeric' };
            const formattedTime = resDate.toLocaleDateString('en-US', dateOptions) + ' - ' + resDate.toLocaleTimeString('en-US', timeOptions);
            const custName = r.customer_name || `Cust #${r.customer_id}`;
            
            return `
                <div class="res-card">
                    <div class="res-card-header">
                        <h4><i class="fa-solid fa-user"></i> ${custName}</h4>
                        <div class="time"><i class="fa-regular fa-calendar"></i> ${formattedTime}</div>
                    </div>
                    <div class="res-card-body">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            <span><i class="fa-solid fa-phone" style="color:var(--text-muted)"></i> <strong>${r.customer_phone || '-'}</strong></span>
                            <span><i class="fa-solid fa-envelope" style="color:var(--text-muted)"></i> <strong>${r.customer_email || '-'}</strong></span>
                        </div>
                        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;">
                            <span><i class="fa-solid fa-users" style="color:var(--text-muted)"></i> Guests: <strong>${r.guests}</strong></span>
                            <span><i class="fa-solid fa-clock-rotate-left" style="color:var(--text-muted)"></i> Created: <strong>${new Date(r.created_at || r.time).toLocaleDateString('en-US')}</strong></span>
                        </div>
                        ${r.requests ? `<div style="margin-top: 5px;"><i class="fa-solid fa-bell-concierge" style="color:var(--text-muted)"></i> Notes: <strong>${r.requests}</strong></div>` : ''}
                    </div>
                    <div class="res-actions">
                        <button class="btn-cancel-res" onclick="cancelReservation(${r.reservation_id}, event)"><i class="fa-solid fa-ban"></i> Cancel Booking</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    document.getElementById('table-modal').style.display = 'flex';
}

function closeTableModal() {
    document.getElementById('tableStatusModal').style.display = 'none';
}

async function changeTableStatus(newStatus) {
    if (!selectedTableId) return;
    try {
        const res = await fetch('/api/update_table_status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({table_id: selectedTableId, status: newStatus})
        });
        if (res.ok) {
            closeTableModal();
            if (typeof fetchTablesFromDB === 'function') fetchTablesFromDB();
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// 3. جلب ورسم جدول الحجوزات الذكي
// ==========================================
async function loadReservations() {
    // حل مشكلة البطء الشديد: قفل يمنع إرسال طلب جديد لو القديم مخلصش
    if (isFetching) return;
    isFetching = true;

    try {
        const range = document.getElementById('res-range')?.value || 'today';
        const startDate = document.getElementById('res-start-date')?.value || '';
        const endDate = document.getElementById('res-end-date')?.value || '';
        const history = document.getElementById('res-history')?.value || 'upcoming';
        
        let url = `${API}/reservations?range=${range}&history=${history}&t=${new Date().getTime()}`;
        if(startDate) url += `&start_date=${startDate}`;
        if(endDate) url += `&end_date=${endDate}`;

        const res = await fetch(url);
        const data = await res.json();
        
        globalReservations = Array.isArray(data) ? data : (data.reservations || []);
        
        const newDataHash = JSON.stringify(globalReservations);
        if (newDataHash === lastReservationsHash && tablesData.length > 0) {
            isFetching = false;
            return; 
        }
        lastReservationsHash = newDataHash; 
        
        applyFiltersAndRender();
        
        if(tablesData.length === 0) {
            await loadTables();
        } else {
            renderTablesMap();
        }

    } catch(err) { 
        console.error("Reservation Load Error:", err); 
    } finally {
        isFetching = false; // فك القفل عشان الطلب اللي بعده يشتغل
    }
}

function applyFiltersAndRender() {
    const rangeFilter = document.getElementById('res-range')?.value || 'today';
    let filteredData = globalReservations;

    if (rangeFilter === 'cancelled') {
        filteredData = filteredData.filter(r => (r.reservation_status || '').toLowerCase() === 'cancelled');
    } else {
        filteredData = filteredData.filter(r => (r.reservation_status || '').toLowerCase() !== 'cancelled');
    }

    renderReservationsTable(filteredData);
}

function renderReservationsTable(data) {
    const table = document.getElementById('reservations-table');
    if (!table) return;

    table.querySelectorAll('.order-group, .no-data').forEach(el => el.remove());

    if (data && data.length > 0) {
        const rowsHTML = data.map(r => {
            const statusClass = (r.reservation_status || '').toLowerCase();
            const resDate = new Date(r.time);
            
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            const dateOptions = { month: 'short', day: 'numeric' };
            const formattedTime = resDate.toLocaleDateString('en-US', dateOptions) + ' - ' + resDate.toLocaleTimeString('en-US', timeOptions);
            
            const custName = r.customer_name || `Cust #${r.customer_id}`;
            
            return `
                <tbody class="order-group">
                    <tr class="main-row" onclick="this.parentElement.classList.toggle('expanded')">
                        <td data-label="Res ID"><strong>#${r.reservation_id}</strong></td>
                        <td data-label="Customer"><strong>${custName}</strong></td>
                        <td data-label="Table"><strong>${r.table_name || 'T-'+r.table_id}</strong></td>
                        <td data-label="Time">${formattedTime}</td>
                        <td data-label="Guests">${r.guests} Pax</td>
                        <td data-label="Status"><span class="badge ${statusClass}">${r.reservation_status}</span></td>
                        <td class="action-cell"><i class="fa-solid fa-chevron-down toggle-icon"></i></td>
                    </tr>
                    <tr class="details-row">
                        <td colspan="7">
                            <div class="expanded-details">
                                <div class="detail-item">
                                    <span>Contact Info</span>
                                    <div><i class="fa-solid fa-phone" style="width: 15px; color: var(--text-muted)"></i> ${r.customer_phone || 'N/A'}</div>
                                    <div style="margin-top: 4px;"><i class="fa-solid fa-envelope" style="width: 15px; color: var(--text-muted)"></i> ${r.customer_email || 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <span>Booking Details</span>
                                    <div><strong>Created At:</strong> <span style="display:inline; color:var(--text-main); font-weight:normal; font-size: 0.9rem;">${new Date(r.created_at || r.time).toLocaleString('en-US')}</span></div>
                                    <div style="margin-top: 4px;"><strong>Notes:</strong> ${r.requests || 'None'}</div>
                                </div>
                                <div class="detail-item" style="display:flex; align-items:flex-end; grid-column: 1 / -1; justify-content: flex-end;">
                                    ${(r.reservation_status || '').toLowerCase() !== 'cancelled' 
                                        ? `<button class="btn-cancel-res" onclick="cancelReservation(${r.reservation_id}, event)"><i class="fa-solid fa-ban"></i> Cancel Booking</button>` 
                                        : ''}
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            `;
        }).join('');
        table.insertAdjacentHTML('beforeend', rowsHTML);
    } else {
        table.insertAdjacentHTML('beforeend', `<tbody class="no-data"><tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No bookings found for the selected filters.</td></tr></tbody>`);
    }
    applySearchFilter();
}

document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (currentSort.column === column) { currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc'; } 
        else { currentSort.column = column; currentSort.direction = 'asc'; }

        document.querySelectorAll('th.sortable').forEach(el => el.classList.remove('asc', 'desc'));
        th.classList.add(currentSort.direction);

        const rangeFilter = document.getElementById('res-range')?.value || 'today';
        let dataToSort = globalReservations;
        
        if (rangeFilter === 'cancelled') {
            dataToSort = dataToSort.filter(r => (r.reservation_status || '').toLowerCase() === 'cancelled');
        } else {
            dataToSort = dataToSort.filter(r => (r.reservation_status || '').toLowerCase() !== 'cancelled');
        }

        const sortedData = [...dataToSort].sort((a, b) => {
            let valA, valB;
            if (column === 'id') { valA = a.reservation_id; valB = b.reservation_id; } 
            else if (column === 'customer') { valA = (a.customer_name || '').toLowerCase(); valB = (b.customer_name || '').toLowerCase(); } 
            else if (column === 'table') { valA = a.table_name || ''; valB = b.table_name || ''; } 
            else if (column === 'time') { valA = new Date(a.time); valB = new Date(b.time); } 
            else if (column === 'guests') { valA = a.guests; valB = b.guests; }
            else if (column === 'status') { valA = a.reservation_status || ''; valB = b.reservation_status || ''; }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        renderReservationsTable(sortedData);
    });
});

function applySearchFilter() {
    const s = document.getElementById('res-search')?.value.toLowerCase() || '';
    document.querySelectorAll('.order-group').forEach(group => {
        const text = group.textContent.toLowerCase();
        group.style.display = text.includes(s) ? '' : 'none';
    });
}

async function cancelReservation(id, event) {
    event.stopPropagation(); 
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    try {
        const res = await fetch('/api/cancel-reservation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservation_id: id })
        });
        const data = await res.json();
        
        if(data.success) {
            lastReservationsHash = ""; // إجبار التحديث
            await loadReservations(); 
            const tableModal = document.getElementById('table-modal');
            if(tableModal.style.display === 'flex' && typeof selectedTableId !== 'undefined' && selectedTableId) {
                const tableName = document.getElementById('modal-table-title').innerText.replace('Table ', '').replace(' Bookings', '').trim();
                openTableDetails(selectedTableId, tableName); 
            }
        } else {
            alert("Error cancelling booking: " + data.message);
            btn.innerHTML = originalText;
        }
    } catch(err) { 
        console.error("Cancel Error:", err); 
        btn.innerHTML = originalText; 
    }
}