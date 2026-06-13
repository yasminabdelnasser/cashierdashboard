document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadHistory();
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('en-US', options);
    }

        setInterval(() => {
        const now = new Date();
        if (now.getHours() === 2 && now.getMinutes() === 58) {
            const todayStr = now.toLocaleDateString('en-US');
            
            // لو محملناش ملف النهاردة، حمله
            if (localStorage.getItem('lastAutoDownload') !== todayStr) {
                localStorage.setItem('lastAutoDownload', todayStr);
                
                // بنكلم الباك إند دايركت نجيب الداتا من غير ما نحتاج الجدول
                fetch('https://yasonasser-dashboard.hf.space/api/get_order_history')
                    .then(response => response.json())
                    .then(data => {
                        // تجهيز رأس ملف الإكسيل
                        let csv = 'Order ID,Customer Name,Order Type,Items Details,Time,Amount,Status\n';
                        
                        // رص الداتا في الإكسيل
                        data.history.forEach(order => {
                            const itemsSummary = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(' + ');
                            const id = `"#${order.id}"`;
                            const customer = `"${order.customer.replace(/"/g, '""')}"`;
                            const type = `"${order.type}"`;
                            const items = `"${itemsSummary.replace(/"/g, '""')}"`;
                            const time = `"${order.time}"`;
                            const amount = `"${order.total} EGP"`;
                            
                            csv += `${id},${customer},${type},${items},${time},${amount},"Completed"\n`;
                        });
                        
                        // إنشاء وتحميل الملف
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = window.URL.createObjectURL(blob);
                        link.download = `AKLTECH_Daily_Sales_${todayStr.replace(/\//g, '-')}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // ريفرش للصفحة لتنظيف اليومية
                        setTimeout(() => window.location.reload(), 60000);
                    })
                    .catch(error => console.error("Error downloading backup:", error));
            }
        }
    }, 1000);

    // --- كود تغيير الثيم (Light/Dark Mode) ---
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const body = document.body;

    if (localStorage.getItem('theme') === 'light') {
        body.classList.add('light-mode');
        if(themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
    }

    if(themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            if (body.classList.contains('light-mode')) {
                localStorage.setItem('theme', 'light');
                themeIcon.classList.replace('fa-sun', 'fa-moon');
            } else {
                localStorage.setItem('theme', 'dark');
                themeIcon.classList.replace('fa-moon', 'fa-sun');
            }
        });
    }
});

// --- دوال القائمة الجانبية (Sidebar Logic) ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('active');
    } else {
        sidebar.classList.toggle('hidden');
    }
}

function goToPage(pageName) {
    if (pageName === 'dashboard') {
        window.location.href = '/dashboard'; 
    } else if (pageName === 'payment') {
        localStorage.setItem('openPaymentTab', 'true');
        window.location.href = '/dashboard';
    }
}

function checkAuth() {
    console.log("Auth checked - Name handled by Flask");
}

async function loadHistory() {
    try {
        const response = await fetch('https://yasonasser-dashboard.hf.space/api/get_order_history');
        const data = await response.json();
        const completedOrders = data.history;
        
        const tableBody = document.getElementById('history-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = ''; 
        
        for (const order of completedOrders) {
            // الداتا جاية جاهزة من الباك إند ومش محتاجين نعمل fetch تاني
            const itemsSummary = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(' + ');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-family:monospace; color:var(--primary); font-weight:bold;">#${order.id}</td>
                <td style="font-weight:600; color:var(--text-main);">${order.customer}</td>
                <td>
                    <span style="background:var(--bg-hover); padding:4px 10px; border-radius:6px; font-size:0.8rem; color:var(--text-muted); font-weight:bold; border:1px solid var(--border-color);">
                        ${order.type}
                    </span>
                </td>
                <td style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted);" title="${itemsSummary}">
                    ${itemsSummary || 'No items found'}
                </td>
                <td style="color:var(--text-main);">${order.time}</td>
                <td style="font-weight:bold; color:var(--text-main);">${order.total} EGP</td>
                <td><span class="status-badge completed">Paid</span></td>
            `;
            tableBody.appendChild(row);
        }
        
        // تحديث الإحصائيات
        updateStats(completedOrders); 

    } catch (error) {
        console.error("Error loading history:", error);
    }
}

function updateStats(completedOrders) {
    const completedEl = document.getElementById('total-completed');
    const revenueEl = document.getElementById('total-revenue');
    const avgEl = document.getElementById('avg-items');

    if (completedEl) completedEl.innerText = completedOrders.length;
    
    const totalRevenue = completedOrders.reduce((sum, order) => {
        const orderTotal = parseFloat(order.total) || 0; 
        return sum + orderTotal;
    }, 0); 
    
    if (revenueEl) revenueEl.innerText = totalRevenue.toFixed(2).toLocaleString() + ' EGP'; 
    
    let totalItems = 0;
    completedOrders.forEach(o => {
        if(o.items && Array.isArray(o.items)) {
             totalItems += o.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
        }
    });

    const avg = completedOrders.length ? (totalItems / completedOrders.length).toFixed(1) : 0;
    if (avgEl) avgEl.innerText = avg;
}

// --- دالة التصدير للإكسيل ---
function exportTableToCSV(filename) {
    const csv = [];
    const rows = document.querySelectorAll("table tr");
    
    if(rows.length <= 1) { alert("No data to export!"); return; }

    for (let i = 0; i < rows.length; i++) {
        const row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) 
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"'); 
        csv.push(row.join(","));         
    }
    downloadCSV(csv.join("\n"), filename);
}

function downloadCSV(csv, filename) {
    const csvFile = new Blob([csv], {type: "text/csv"});
    const downloadLink = document.createElement("a");
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// --- دالة البحث السريع (Live Search) ---
function searchHistory() {
    const input = document.getElementById("history-search");
    const filter = input.value.toLowerCase();
    const tableBody = document.getElementById("history-table-body");
    const rows = tableBody.getElementsByTagName("tr");

    for (let i = 0; i < rows.length; i++) {
        // بنجمع كل الكلام اللي في الصف (الاسم، رقم الأوردر، الأكل، السعر)
        const rowText = rows[i].innerText.toLowerCase();
        
        // لو الكلام اللي في السيرش موجود في الصف، بنظهره، غير كده بنخفيه
        if (rowText.includes(filter)) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}
