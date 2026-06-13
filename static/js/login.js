document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordField = document.getElementById('password');
    
    // أزرار الثيم (الأساسي واللي جوه شاشة الترحيب)
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeBtnCurtain = document.getElementById('theme-toggle-curtain');
    const themeIconCurtain = document.getElementById('theme-icon-curtain');

    // تأثير الستارة الاحترافي (Cinematic Curtain)
    const enterBtn = document.getElementById('enter-btn');
    const welcomeCurtain = document.getElementById('welcome-curtain');
    const loginContainer = document.getElementById('login-container');

    if (enterBtn && welcomeCurtain && loginContainer) {
        enterBtn.addEventListener('click', () => {
            welcomeCurtain.classList.add('slide-up');
            
            setTimeout(() => {
                loginContainer.classList.add('show');
            }, 300);
            
            setTimeout(() => {
                welcomeCurtain.style.display = 'none';
            }, 900);
        });
    }

    // إظهار وإخفاء الباسورد
    if (togglePassword && passwordField) {
        togglePassword.addEventListener('click', function() {
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // --- نظام الثيم المزدوج (الستارة والشاشة الأساسية) ---
    
    // دالة موحدة لتبديل الثيم بتسمّع في الزرارين مع بعض
    const toggleTheme = () => {
        const isLight = document.documentElement.classList.toggle('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        // تغيير الأيقونات في الزرارين في نفس اللحظة
        const icons = [themeIcon, themeIconCurtain];
        icons.forEach(icon => {
            if (icon) {
                if (isLight) {
                    icon.classList.replace('fa-moon', 'fa-sun');
                } else {
                    icon.classList.replace('fa-sun', 'fa-moon');
                }
            }
        });
    };

    // 1. تظبيط الأيقونات في البداية عند التحميل
    if (document.documentElement.classList.contains('light-mode')) {
        if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        if (themeIconCurtain) themeIconCurtain.classList.replace('fa-moon', 'fa-sun');
    }

    // 2. تشغيل التبديل عند الضغط على أي زرار فيهم
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (themeBtnCurtain) themeBtnCurtain.addEventListener('click', toggleTheme);

    // زرار الدخول وقت التحميل
    if (loginForm) {
        loginForm.addEventListener('submit', function() {
            const btn = loginForm.querySelector('.btn-submit');
            if (btn) {
                // تغيير الكلمة لتكون أكثر احترافية
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying credentials...';
                btn.style.opacity = '0.8';
                btn.style.pointerEvents = 'none';
            }
        });
    }
});