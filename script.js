document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const auth = firebase.auth();

    // --- DOM Elements ---
    const authSection = document.getElementById('auth-section');
    const loginCard = document.getElementById('login-card');
    const signupCard = document.getElementById('signup-card');
    const mainContainer = document.getElementById('main-container');

    const adminView = document.getElementById('admin-view');
    const roomView = document.getElementById('room-view');
    const roomListContainer = document.getElementById('room-list');
    const btnBackAdmin = document.getElementById('btn-back-admin');
    const currentRoomDisplay = document.getElementById('current-room-display');

    // Forms
    const loginForm = document.getElementById('login-form');
    const loginRoomInput = document.getElementById('login-room');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');

    const signupForm = document.getElementById('signup-form');
    const signupRoomInput = document.getElementById('signup-room');
    const signupPassword = document.getElementById('signup-password');
    const signupCodeInput = document.getElementById('signup-code');
    const signupError = document.getElementById('signup-error');

    // Toggles
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');

    // Controls
    const masterOff = document.getElementById('master-off');
    const masterOn = document.getElementById('master-on');
    const connectionStatus = document.getElementById('connection-status');

    // Sensors
    const tempValue = document.getElementById('temp-value');
    const presenceValue = document.getElementById('presence-value');
    const lightValValue = document.getElementById('light-val-value');

    // Config
    const DEVICE_COUNT = 3;
    const ADMIN_CODE = "123456"; // System verification code
    const SUPER_ADMIN_EMAIL = "nguyennguyentinh12082005@gmail.com";

    // State
    let state = {
        lights: [false, false, false],
        fans: [false, false, false],
        fanSpeeds: [50, 50, 50]
    };
    let currentUserRole = null;
    let currentRoomId = null;
    let activeListeners = []; // Array of { ref: db.ref, event: 'value', callback: fn }

    // --- Initialization ---
    // ... (init function remains same, managed by replace logic) -> Wait, I am replacing a block, need to be careful.
    // I will replace the submit handlers specifically or the whole block if needed.
    // Let's replace from Config down to Signup Handler to be safe.

    // Actually, let's just replace the submit handlers and the Config constant area.

    // --- Initialization ---
    function init() {
        auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            .then(() => {
                auth.onAuthStateChanged((user) => {
                    if (user) {
                        console.log("Logged in:", user.email);
                        handleUserSession(user);
                    } else {
                        showLoginView();
                    }
                });
            })
            .catch(err => console.error("Persistence Error:", err));
    }

    // --- Auth Logic ---
    function showLoginView() {
        authSection.style.display = 'flex';
        mainContainer.style.display = 'none';
        loginCard.style.display = 'block';
        signupCard.style.display = 'none';
        resetState();
    }

    function handleUserSession(user) {
        // Fetch user profile to get Role and RoomID
        db.ref('users/' + user.uid).once('value')
            .then(snapshot => {
                const data = snapshot.val();
                if (data) {
                    currentUserRole = data.role;
                    const homeRoom = data.roomId;

                    // Special Check for Super Admin
                    if (user.email === SUPER_ADMIN_EMAIL) {
                        currentUserRole = 'admin';
                    }

                    authSection.style.display = 'none';
                    mainContainer.style.display = 'block';

                    if (currentUserRole === 'admin') {
                        loadAdminDashboard();
                    } else {
                        loadRoomView(homeRoom);
                    }
                } else {
                    // Fallback: If no profile but is Super Admin, create one or allow access
                    if (user.email === SUPER_ADMIN_EMAIL) {
                        currentUserRole = 'admin';
                        authSection.style.display = 'none';
                        mainContainer.style.display = 'block';
                        loadAdminDashboard();
                        return;
                    }

                    console.error("No user profile found");
                    auth.signOut();
                }
            });
    }

    function resetState() {
        currentUserRole = null;
        currentRoomId = null;
        detachListeners();
    }

    // --- Signup / Login Handlers ---
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.style.display = 'none';
            signupCard.style.display = 'block';
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupCard.style.display = 'none';
            loginCard.style.display = 'block';
        });
    }

    function formatEmail(input) {
        if (input.includes('@')) return input;
        return input.trim() + "@smartclass.local";
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = loginRoomInput.value.trim();
            const email = formatEmail(input);
            auth.signInWithEmailAndPassword(email, loginPassword.value)
                .catch(err => loginError.textContent = "Lỗi: " + err.message);
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = signupRoomInput.value.trim();
            const email = formatEmail(input);
            const pass = signupPassword.value;
            const code = signupCodeInput.value.trim();

            if (code !== ADMIN_CODE) {
                signupError.textContent = "Mã xác nhận không đúng!";
                return;
            }

            auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => {
                    // Create User Profile
                    let role = 'user';
                    let roomId = input.toUpperCase();

                    // Check for Admin conditions
                    if (email === SUPER_ADMIN_EMAIL || roomId === 'ADMIN') {
                        role = 'admin';
                        roomId = 'ADMIN_PANEL';
                    }

                    return db.ref('users/' + cred.user.uid).set({
                        email: email,
                        roomId: roomId,
                        role: role,
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                })
                .then(() => {
                    // Init Room Data if not exists (optional, but good for safety)
                    const roomId = input.toUpperCase();
                    if (roomId !== 'ADMIN' && email !== SUPER_ADMIN_EMAIL && !email.includes('gmail.com')) {
                        db.ref('Rooms/' + roomId).update({ created: true });
                    }
                    alert("Tạo tài khoản thành công!");
                })
                .catch(err => signupError.textContent = "Lỗi: " + err.message);
        });
    }

    if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());


    // --- Admin Dashboard logic ---
    function loadAdminDashboard() {
        adminView.style.display = 'block';
        roomView.style.display = 'none';
        btnBackAdmin.style.display = 'none';
        currentRoomDisplay.textContent = "Admin Control Panel";

        roomListContainer.innerHTML = '<p>Đang tải danh sách phòng...</p>';

        detachListeners(); // Clear any device listeners

        // Listen to Rooms node
        const roomsRef = db.ref('Rooms');
        const roomsCb = (snapshot) => {
            const rooms = snapshot.val();
            roomListContainer.innerHTML = '';

            if (!rooms) {
                roomListContainer.innerHTML = '<p>Chưa có phòng nào được tạo dữ liệu.</p>';
                return;
            }

            Object.keys(rooms).forEach(roomId => {
                const card = document.createElement('div');
                card.className = 'room-card';
                card.innerHTML = `
                    <i class="fa-solid fa-chalkboard-user"></i>
                    <h3>${roomId}</h3>
                `;
                card.addEventListener('click', () => {
                    loadRoomView(roomId);
                });
                roomListContainer.appendChild(card);
            });
        };
        roomsRef.on('value', roomsCb);
        activeListeners.push({ ref: roomsRef, event: 'value', callback: roomsCb });
    }

    if (btnBackAdmin) {
        btnBackAdmin.addEventListener('click', () => {
            if (currentUserRole === 'admin') {
                loadAdminDashboard();
            }
        });
    }

    // --- Room View Logic ---
    function loadRoomView(roomId) {
        currentRoomId = roomId;

        adminView.style.display = 'none';
        roomView.style.display = 'block';
        currentRoomDisplay.textContent = roomId;

        if (currentUserRole === 'admin') {
            btnBackAdmin.style.display = 'flex';
        } else {
            btnBackAdmin.style.display = 'none';
        }

        setupDeviceListeners(roomId);
    }

    function detachListeners() {
        activeListeners.forEach(l => l.ref.off(l.event, l.callback));
        activeListeners = [];
    }

    function setupDeviceListeners(roomId) {
        detachListeners();

        const basePath = `Rooms/${roomId}`; // NEW SCHEMA

        // 1. Connection (Reuse existing logic but ensure only one listener)
        const connectedRef = db.ref(".info/connected");
        const connectedCb = (snap) => {
            if (snap.val() === true) {
                connectionStatus.style.opacity = '1';
                connectionStatus.querySelector('span').textContent = 'Đã kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#00b894';
            } else {
                connectionStatus.style.opacity = '0.7';
                connectionStatus.querySelector('span').textContent = 'Mất kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#ff7675';
            }
        };
        connectedRef.on("value", connectedCb);
        activeListeners.push({ ref: connectedRef, event: "value", callback: connectedCb });

        // 2. Sensors
        // Expecting Rooms/RID/NhietDo, etc.
        const sensorMap = {
            'NhietDo': tempValue,
            'PhatHienNguoi': presenceValue,
            'AnhSang': lightValValue
        };

        Object.keys(sensorMap).forEach(key => {
            const ref = db.ref(`${basePath}/${key}`);
            const cb = (snap) => {
                const val = snap.val();
                const el = sensorMap[key];
                if (!el) return;

                if (key === 'PhatHienNguoi') {
                    const hasMotion = val == 1 || val === true || val === '1' || val === 'motion';
                    presenceValue.textContent = hasMotion ? 'Có' : 'Không';
                    presenceValue.style.color = hasMotion ? '#00b894' : '#fab1a0';
                } else {
                    tempValue.textContent = val !== null ? val : '--'; // Wait, hardcoded tempValue for loop? No, handled by map.
                    if (key === 'NhietDo') tempValue.textContent = val !== null ? val : '--';
                    if (key === 'AnhSang') lightValValue.textContent = val !== null ? val : '--';
                }
            };
            ref.on('value', cb);
            activeListeners.push({ ref: ref, event: 'value', callback: cb });
        });

        // 3. Devices (Loops)
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            // Lights
            const lightRef = db.ref(`${basePath}/Den${i}`);
            const lightCb = (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                state.lights[i] = isOn;
                const toggle = document.getElementById(`light-toggle-${i}`);
                if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                updateLightUI(i, isOn);
            };
            lightRef.on('value', lightCb);
            activeListeners.push({ ref: lightRef, event: 'value', callback: lightCb });

            // Fans
            const fanRef = db.ref(`${basePath}/Quat${i}`);
            const fanCb = (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                state.fans[i] = isOn;
                const toggle = document.getElementById(`fan-toggle-${i}`);
                if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                updateFanUI(i, isOn);
            };
            fanRef.on('value', fanCb);
            activeListeners.push({ ref: fanRef, event: 'value', callback: fanCb });

            // Fan Speed
            const speedRef = db.ref(`${basePath}/TocDoQuat${i}`);
            const speedCb = (snap) => {
                const val = snap.val();
                if (val !== null) {
                    state.fanSpeeds[i] = parseInt(val);
                    const slider = document.getElementById(`fan-speed-${i}`);
                    if (slider) slider.value = state.fanSpeeds[i];
                    const label = document.getElementById(`fan-speed-value-${i}`);
                    if (label) label.textContent = `${state.fanSpeeds[i]}%`;
                    updateFanAnimation(i);
                }
            };
            speedRef.on('value', speedCb);
            activeListeners.push({ ref: speedRef, event: 'value', callback: speedCb });
        }
    }

    // --- Actions ---
    function toggleLight(index, isOn) {
        if (!currentRoomId) return;
        const val = isOn ? 1 : 0;
        db.ref(`Rooms/${currentRoomId}/Den${index}`).set(val)
            .catch(err => showToast(`Lỗi: ` + err.message, 'error'));
    }

    function toggleFan(index, isOn) {
        if (!currentRoomId) return;
        const val = isOn ? 1 : 0;
        db.ref(`Rooms/${currentRoomId}/Quat${index}`).set(val)
            .catch(err => showToast(`Lỗi: ` + err.message, 'error'));
    }

    function setFanSpeed(index, value) {
        if (!currentRoomId) return;
        db.ref(`Rooms/${currentRoomId}/TocDoQuat${index}`).set(parseInt(value))
            .catch(err => console.error(err));
    }

    function turnAllOff() {
        if (!currentRoomId) return;
        const updates = {};
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            updates[`Rooms/${currentRoomId}/Den${i}`] = 0;
            updates[`Rooms/${currentRoomId}/Quat${i}`] = 0;
        }
        db.ref().update(updates)
            .then(() => showToast('Đã tắt tất cả (Phòng ' + currentRoomId + ')'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function turnAllOn() {
        if (!currentRoomId) return;
        const updates = {};
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            updates[`Rooms/${currentRoomId}/Den${i}`] = 1;
            updates[`Rooms/${currentRoomId}/Quat${i}`] = 1;
        }
        db.ref().update(updates)
            .then(() => showToast('Đã bật tất cả (Phòng ' + currentRoomId + ')', 'success'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    // UI Updates (Same as before)
    function updateLightUI(index, isOn) {
        const statusEl = document.getElementById(`light-status-${index}`);
        const card = document.getElementById(`card-light-${index}`);
        if (statusEl) statusEl.textContent = isOn ? 'Đang Bật' : 'Đang Tắt';
        if (isOn) card.classList.add('active');
        else card.classList.remove('active');
    }

    function updateFanUI(index, isOn) {
        const statusEl = document.getElementById(`fan-status-${index}`);
        const card = document.getElementById(`card-fan-${index}`);
        if (statusEl) statusEl.textContent = isOn ? 'Đang Bật' : 'Đang Tắt';
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
            const animSpeed = 2.2 - (state.fanSpeeds[index] / 100 * 2);
            icon.style.animationDuration = `${animSpeed}s`;
        }
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => { if (toast.parentElement) container.removeChild(toast); }, 400);
        }, 3000);
    }

    // --- Binding Static Listeners ---
    if (masterOff) masterOff.addEventListener('click', turnAllOff);
    if (masterOn) masterOn.addEventListener('click', turnAllOn);

    // Device Controls Delegation
    for (let i = 1; i <= DEVICE_COUNT; i++) {
        const lToggle = document.getElementById(`light-toggle-${i}`);
        if (lToggle) lToggle.addEventListener('change', (e) => toggleLight(i, e.target.checked));

        const fToggle = document.getElementById(`fan-toggle-${i}`);
        if (fToggle) fToggle.addEventListener('change', (e) => toggleFan(i, e.target.checked));

        const fSpeed = document.getElementById(`fan-speed-${i}`);
        if (fSpeed) {
            fSpeed.addEventListener('change', (e) => setFanSpeed(i, e.target.value));
            fSpeed.addEventListener('input', (e) => {
                const lbl = document.getElementById(`fan-speed-value-${i}`);
                if (lbl) lbl.textContent = `${e.target.value}%`;
            });
        }
    }

    // Start
    init();
});
