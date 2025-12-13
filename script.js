document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyD5TdgspR2HG4y97LdzbFtZ-LzdSloXsAE",
        authDomain: "smart-classroom-1796a.firebaseapp.com",
        databaseURL: "https://smart-classroom-1796a-default-rtdb.firebaseio.com",
        projectId: "smart-classroom-1796a",
        storageBucket: "smart-classroom-1796a.firebasestorage.app",
        messagingSenderId: "432808052370",
        appId: "1:432808052370:web:ae5ccf8abbe0b984a3884b",
        measurementId: "G-QL0GG52SVL"
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();

    // DOM Elements
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
    const humidValue = document.getElementById('humid-value');
    const lightValValue = document.getElementById('light-val-value');

    // State Management (Local mirror of DB)
    let state = {
        light: false,
        fan: false,
        fanSpeed: 50
    };

    // --- Initialization & Listeners ---
    function init() {
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

        setupSensorListeners();
        setupDeviceListeners();
    }

    // --- Firebase Listeners ---
    function setupSensorListeners() {
        // Temperature -> SmartHome/NhietDo
        db.ref('SmartHome/NhietDo').on('value', (snapshot) => {
            const val = snapshot.val();
            console.log("Nhiệt độ (SmartHome/NhietDo):", val);
            tempValue.textContent = val !== null ? val : '--';
        });

        // Humidity -> Không có trong DB, tạm thời comment out hoặc để trống
        // db.ref('SmartHome/DoAm').on('value', (snapshot) => { ... });
        // Sẽ hiển thị -- cho độ ẩm

        // Light Sensor -> SmartHome/AnhSang
        db.ref('SmartHome/AnhSang').on('value', (snapshot) => {
            const val = snapshot.val();
            console.log("Ánh sáng (SmartHome/AnhSang):", val);
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
    lightToggle.addEventListener('change', (e) => {
        // Determine user intent vs programatic update
        // (For simple toggle, just sending the new state is fine)
        toggleLight(e.target.checked);
    });

    fanToggle.addEventListener('change', (e) => {
        toggleFan(e.target.checked);
    });

    fanSpeed.addEventListener('change', (e) => { // 'change' fires only on release
        setFanSpeed(e.target.value);
    });

    // Optional: Update UI while dragging slider without sending command yet
    fanSpeed.addEventListener('input', (e) => {
        fanSpeedValue.textContent = `${e.target.value}%`;
    });

    masterToggle.addEventListener('click', turnAllOff);

    // Run Init
    init();
});
