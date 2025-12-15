document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const auth = firebase.auth();

    // DOM Elements - Sections
    const loginSection = document.getElementById('login-section');
    const mainContainer = document.getElementById('main-container');

    // Auth Elements
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // Master Control
    const masterToggle = document.getElementById('master-toggle');
    const connectionStatus = document.getElementById('connection-status');

    // Sensors
    const tempValue = document.getElementById('temp-value');
    const presenceValue = document.getElementById('presence-value');
    const lightValValue = document.getElementById('light-val-value');

    // Config
    const DEVICE_COUNT = 3;

    // State Management
    let state = {
        lights: [false, false, false], // Index 0 is unused, usage 1-3
        fans: [false, false, false],
        fanSpeeds: [50, 50, 50]
    };

    // --- Initialization ---
    function init() {
        // Enforce Session Persistence -> Clears auth on tab close
        auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            .then(() => {
                auth.onAuthStateChanged((user) => {
                    if (user) {
                        console.log("Logged in:", user.email);
                        if (loginSection) loginSection.style.display = 'none';
                        if (mainContainer) mainContainer.style.display = 'block';

                        setupConnectionListener();
                        setupSensorListeners();
                        setupDeviceListeners();
                    } else {
                        if (loginSection) loginSection.style.display = 'flex';
                        if (mainContainer) mainContainer.style.display = 'none';
                    }
                });
            })
            .catch(err => console.error("Persistence Error:", err));
    }

    function setupConnectionListener() {
        db.ref(".info/connected").on("value", (snap) => {
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

    // --- Sensors ---
    function setupSensorListeners() {
        db.ref('SmartHome/NhietDo').on('value', snap => {
            tempValue.textContent = snap.val() !== null ? snap.val() : '--';
        });

        db.ref('SmartHome/PhatHienNguoi').on('value', snap => {
            const val = snap.val();
            const hasMotion = val == 1 || val === true || val === '1' || val === 'motion';
            presenceValue.textContent = hasMotion ? 'Có' : 'Không';
            presenceValue.style.color = hasMotion ? '#00b894' : '#fab1a0'; // Green vs Soft Red
        });

        db.ref('SmartHome/AnhSang').on('value', snap => {
            lightValValue.textContent = snap.val() !== null ? snap.val() : '--';
        });
    }

    // --- Devices Listener & UI ---
    function setupDeviceListeners() {
        // LIGHTS LOOP (1 to 3)
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            // Firebase Path: SmartHome/Den1, SmartHome/Den2...
            db.ref(`SmartHome/Den${i}`).on('value', (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                state.lights[i] = isOn;

                // Update UI
                const toggle = document.getElementById(`light-toggle-${i}`);
                if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                updateLightUI(i, isOn);
            });

            // FANS LOOP (1 to 3)
            // State Path: SmartHome/Quat1...
            db.ref(`SmartHome/Quat${i}`).on('value', (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                state.fans[i] = isOn;

                const toggle = document.getElementById(`fan-toggle-${i}`);
                if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                updateFanUI(i, isOn);
            });

            // Fan Speed Path: SmartHome/TocDoQuat1...
            db.ref(`SmartHome/TocDoQuat${i}`).on('value', (snap) => {
                const val = snap.val();
                if (val !== null) {
                    state.fanSpeeds[i] = parseInt(val);
                    const slider = document.getElementById(`fan-speed-${i}`);
                    if (slider) slider.value = state.fanSpeeds[i];

                    const label = document.getElementById(`fan-speed-value-${i}`);
                    if (label) label.textContent = `${state.fanSpeeds[i]}%`;

                    // Update animation speed if fan is on
                    updateFanAnimation(i);
                }
            });
        }
    }

    function updateLightUI(index, isOn) {
        const status = document.getElementById(`light-status-${index}`);
        const icon = document.getElementById(`light-icon-${index}`);
        const card = document.getElementById(`card-light-${index}`);
        const container = card.querySelector('.icon-container');

        if (status) status.textContent = isOn ? 'Đang Bật' : 'Đang Tắt';

        if (isOn) {
            card.classList.add('active');
            // Icon color handled by CSS .active .icon-container
        } else {
            card.classList.remove('active');
        }
    }

    function updateFanUI(index, isOn) {
        const status = document.getElementById(`fan-status-${index}`);
        const card = document.getElementById(`card-fan-${index}`);

        if (status) status.textContent = isOn ? 'Đang Bật' : 'Đang Tắt';

        if (isOn) {
            card.classList.add('active');
            updateFanAnimation(index);
        } else {
            card.classList.remove('active');
            const icon = document.getElementById(`fan-icon-${index}`);
            if (icon) {
                icon.classList.remove('spin-animation');
                icon.style.animationDuration = '0s';
            }
        }
    }

    function updateFanAnimation(index) {
        if (!state.fans[index]) return;

        const icon = document.getElementById(`fan-icon-${index}`);
        if (icon) {
            icon.classList.add('spin-animation');
            // Speed logic: 100% -> 0.2s, 0% -> 2.2s
            const animSpeed = 2.2 - (state.fanSpeeds[index] / 100 * 2);
            icon.style.animationDuration = `${animSpeed}s`;
        }
    }

    // --- Actions ---
    function toggleLight(index, isOn) {
        const val = isOn ? 1 : 0;
        db.ref(`SmartHome/Den${index}`).set(val)
            .catch(err => showToast(`Lỗi Đèn ${index}: ` + err.message, 'error'));
    }

    function toggleFan(index, isOn) {
        const val = isOn ? 1 : 0;
        db.ref(`SmartHome/Quat${index}`).set(val)
            .catch(err => showToast(`Lỗi Quạt ${index}: ` + err.message, 'error'));
    }

    function setFanSpeed(index, value) {
        db.ref(`SmartHome/TocDoQuat${index}`).set(parseInt(value))
            .catch(err => console.error(err));
    }

    function turnAllOff() {
        const updates = {};
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            updates[`SmartHome/Den${i}`] = 0;
            updates[`SmartHome/Quat${i}`] = 0;
        }

        db.ref().update(updates)
            .then(() => showToast('Đã tắt tất cả thiết bị'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function turnAllOn() {
        const updates = {};
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            updates[`SmartHome/Den${i}`] = 1;
            updates[`SmartHome/Quat${i}`] = 1;
        }

        db.ref().update(updates)
            .then(() => showToast('Đã bật tất cả thiết bị', 'success'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        // Add icon based on type if needed
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => { if (toast.parentElement) container.removeChild(toast); }, 400);
        }, 3000);
    }

    // --- Event Listeners Binding ---
    // We bind loop events here

    // Auth
    // Auth
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value)
                .catch(err => loginError.textContent = "Lỗi: " + err.message);
        });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

    // Master Controls
    const masterOff = document.getElementById('master-off');
    const masterOn = document.getElementById('master-on');

    if (masterOff) masterOff.addEventListener('click', turnAllOff);
    if (masterOn) masterOn.addEventListener('click', turnAllOn);

    // Device Controls (Using Delegation for cleaner code or just Loop)
    // Since IDs are static, loop is fine.

    // We need to wait for DOM elements to exist? They do.
    for (let i = 1; i <= DEVICE_COUNT; i++) {
        // Light Toggle
        const lToggle = document.getElementById(`light-toggle-${i}`);
        if (lToggle) {
            lToggle.addEventListener('change', (e) => toggleLight(i, e.target.checked));
        }

        // Fan Toggle
        const fToggle = document.getElementById(`fan-toggle-${i}`);
        if (fToggle) {
            fToggle.addEventListener('change', (e) => toggleFan(i, e.target.checked));
        }

        // Fan Speed
        const fSpeed = document.getElementById(`fan-speed-${i}`);
        if (fSpeed) {
            fSpeed.addEventListener('change', (e) => setFanSpeed(i, e.target.value));
            // Live Update Label
            fSpeed.addEventListener('input', (e) => {
                const lbl = document.getElementById(`fan-speed-value-${i}`);
                if (lbl) lbl.textContent = `${e.target.value}%`;
            });
        }
    }

    init();
});
