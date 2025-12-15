document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase (Config loaded from firebase-config.js)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const auth = firebase.auth();

    // DOM Elements - Sections
    const loginSection = document.getElementById('login-section');
    const mainContainer = document.getElementById('main-container');

    // DOM Elements - Auth Logic
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // DOM Elements - Control
    const lightToggle = document.getElementById('light-toggle');
    const lightStatus = document.getElementById('light-status');
    const lightIcon = document.getElementById('light-icon');
    const cardLight = document.getElementById('card-light');

    const fanToggle = document.getElementById('fan-toggle');
    const fanStatus = document.getElementById('fan-status');
    const fanSpeed = document.getElementById('fan-speed');
    const fanSpeedValue = document.getElementById('fan-speed-value');
    const fanIcon = document.getElementById('fan-icon');
    const cardFan = document.getElementById('card-fan');

    const masterToggle = document.getElementById('master-toggle');
    const connectionStatus = document.getElementById('connection-status');

    // Sensor Elements
    const tempValue = document.getElementById('temp-value');
    const presenceValue = document.getElementById('presence-value');
    const lightValValue = document.getElementById('light-val-value');

    // State Management (Local mirror of DB)
    let state = {
        light: false,
        fan: false,
        fanSpeed: 50
    };

    // --- Initialization & Listeners ---
    function init() {
        // Auth Listener - Switch Views
        auth.onAuthStateChanged((user) => {
            if (user) {
                // User is signed in -> Show Dashboard
                console.log("Logged in as:", user.email);

                if (loginSection) loginSection.style.display = 'none';
                if (mainContainer) mainContainer.style.display = 'block';

                // Initialize Listeners
                setupConnectionListener();
                setupSensorListeners();
                setupDeviceListeners();
            } else {
                // User is signed out -> Show Login
                if (loginSection) loginSection.style.display = 'flex';
                if (mainContainer) mainContainer.style.display = 'none';
            }
        });
    }

    function setupConnectionListener() {
        // Checking connection usually happens via .info/connected
        const connectedRef = db.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            if (snap.val() === true) {
                connectionStatus.style.opacity = '1';
                connectionStatus.querySelector('span').textContent = 'Đã kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#00b894';
            } else {
                connectionStatus.style.opacity = '0.7';
                connectionStatus.querySelector('span').textContent = 'Mất kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#ff7675';
            }
        });
    }

    // --- Firebase Listeners ---
    function setupSensorListeners() {
        // Temperature -> SmartHome/NhietDo
        db.ref('SmartHome/NhietDo').on('value', (snapshot) => {
            const val = snapshot.val();
            tempValue.textContent = val !== null ? val : '--';
        });

        // Presence -> SmartHome/PhatHienNguoi
        db.ref('SmartHome/PhatHienNguoi').on('value', (snapshot) => {
            const val = snapshot.val();
            // Robust check: 1, '1', true, 'motion', 'detected'
            const hasMotion = val === 1 || val === '1' || val === true ||
                (typeof val === 'string' && ['motion', 'detected', 'co', 'yes'].includes(val.toLowerCase()));

            presenceValue.textContent = hasMotion ? 'Có' : 'Không';
            presenceValue.style.color = hasMotion ? '#00b894' : '#fab1a0';
        });

        // Light Sensor -> SmartHome/AnhSang
        db.ref('SmartHome/AnhSang').on('value', (snapshot) => {
            const val = snapshot.val();
            lightValValue.textContent = val !== null ? val : '--';
        });
    }

    function setupDeviceListeners() {
        // Light State
        db.ref('devices/light/state').on('value', (snapshot) => {
            // Expect boolean or "on"/"off" string
            const val = snapshot.val();
            const isOn = val === true || val === 'on' || val === 1;

            state.light = isOn;
            // Only update UI if mismatch to prevent loop flicker (though safe with checkbox)
            if (lightToggle.checked !== isOn) {
                lightToggle.checked = isOn;
            }
            updateLightUI();
        });

        // Fan State
        db.ref('devices/fan/state').on('value', (snapshot) => {
            const val = snapshot.val();
            const isOn = val === true || val === 'on' || val === 1;

            state.fan = isOn;
            if (fanToggle.checked !== isOn) {
                fanToggle.checked = isOn;
            }
            updateFanUI();
        });

        // Fan Speed
        db.ref('devices/fan/speed').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val !== null) {
                state.fanSpeed = parseInt(val);
                fanSpeed.value = state.fanSpeed; // Update slider position
                updateFanUI();
            }
        });
    }

    // --- UI Updates ---
    function updateLightUI() {
        lightStatus.textContent = state.light ? 'Đang Bật' : 'Đang Tắt';
        lightStatus.style.color = state.light ? '#fff' : 'rgba(255,255,255,0.7)';

        if (state.light) {
            lightIcon.style.color = '#ffeaa7';
            lightIcon.style.textShadow = '0 0 20px #ffeaa7';
            cardLight.style.borderColor = 'rgba(255, 234, 167, 0.5)';
            cardLight.style.boxShadow = '0 0 20px rgba(255, 234, 167, 0.1)';
        } else {
            lightIcon.style.color = 'rgba(255, 255, 255, 0.8)';
            lightIcon.style.textShadow = 'none';
            cardLight.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            cardLight.style.boxShadow = 'var(--glass-shadow)';
        }
    }

    function updateFanUI() {
        fanStatus.textContent = state.fan ? 'Đang Bật' : 'Đang Tắt';
        fanStatus.style.color = state.fan ? '#fff' : 'rgba(255,255,255,0.7)';
        fanSpeedValue.textContent = `${state.fanSpeed}%`;

        if (state.fan) {
            fanIcon.classList.add('spin-animation');
            cardFan.classList.add('active');
            // Calculate animation speed based on slider (0.2s to 2s)
            const animSpeed = 2.2 - (state.fanSpeed / 100 * 2);
            fanIcon.style.animationDuration = `${animSpeed}s`;

            cardFan.style.borderColor = 'rgba(116, 185, 255, 0.5)';
        } else {
            fanIcon.classList.remove('spin-animation');
            cardFan.classList.remove('active');
            cardFan.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }
    }

    // --- Actions (Write to Firebase) ---
    function toggleLight(isOn) {
        const val = isOn ? 1 : 0;
        db.ref('SmartHome/Den').set(val)
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function toggleFan(isOn) {
        const val = isOn ? 1 : 0;
        db.ref('SmartHome/Quat').set(val)
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function setFanSpeed(value) {
        db.ref('SmartHome/TocDoQuat').set(parseInt(value))
            .catch(err => console.error(err));
    }

    function turnAllOff() {
        const updates = {};
        updates['SmartHome/Den'] = 0;
        updates['SmartHome/Quat'] = 0;

        db.ref().update(updates)
            .then(() => showToast('Đã tắt tất cả thiết bị'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'error') toast.style.borderLeft = '4px solid #ff7675';

        let icon = '<i class="fa-solid fa-info-circle"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-check-circle" style="color: #00b894;"></i>';
        if (type === 'error') icon = '<i class="fa-solid fa-exclamation-circle" style="color: #ff7675;"></i>';

        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) container.removeChild(toast);
            }, 400);
        }, 3000);
    }

    // --- Event Listeners ---

    // Login Handle
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginEmail.value;
            const password = loginPassword.value;
            loginError.textContent = ''; // Clear prev error

            auth.signInWithEmailAndPassword(email, password)
                .catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    console.error("Login error:", errorCode, errorMessage);

                    if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
                        loginError.textContent = 'Email hoặc mật khẩu không đúng.';
                    } else if (errorCode === 'auth/invalid-email') {
                        loginError.textContent = 'Email không hợp lệ.';
                    } else {
                        loginError.textContent = 'Lỗi đăng nhập: ' + errorMessage;
                    }
                });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().catch((error) => {
                console.error("Logout error", error);
            });
        });
    }

    // Control Events
    if (lightToggle) {
        lightToggle.addEventListener('change', (e) => {
            toggleLight(e.target.checked);
        });
    }

    if (fanToggle) {
        fanToggle.addEventListener('change', (e) => {
            toggleFan(e.target.checked);
        });
    }

    if (fanSpeed) {
        fanSpeed.addEventListener('change', (e) => {
            setFanSpeed(e.target.value);
        });

        fanSpeed.addEventListener('input', (e) => {
            fanSpeedValue.textContent = `${e.target.value}%`;
        });
    }

    if (masterToggle) {
        masterToggle.addEventListener('click', turnAllOff);
    }

    // Run Init
    init();
});
