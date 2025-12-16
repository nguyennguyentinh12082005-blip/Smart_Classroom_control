document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const auth = firebase.auth();

    // --- DOM Elements ---
    const mainContainer = document.getElementById('main-container');
    const adminView = document.getElementById('admin-view');
    const roomView = document.getElementById('room-view');
    const roomListContainer = document.getElementById('room-list');
    const btnBackAdmin = document.getElementById('btn-back-admin');
    const currentRoomDisplay = document.getElementById('current-room-display');
    const logoutBtn = document.getElementById('logout-btn');

    // Controls
    const masterOff = document.getElementById('master-off');
    const masterOn = document.getElementById('master-on');

    const autoModeToggle = document.getElementById('auto-mode-toggle');
    const connectionStatus = document.getElementById('connection-status');

    // Sensors
    const tempValue = document.getElementById('temp-value');
    const presenceValue = document.getElementById('presence-value');
    const lightValValue = document.getElementById('light-val-value');

    // Config
    const DEVICE_COUNT = 3;
    const SUPER_ADMIN_EMAIL = "nguyennguyentinh12082005@gmail.com";

    // State
    let state = {
        lights: [false, false, false],
        fans: [false, false, false],
        fanSpeeds: [50, 50, 50]
    };
    let currentUserRole = null;
    let currentRoomId = null;
    let activeListeners = [];

    // --- Auth Check ---
    auth.onAuthStateChanged((user) => {
        if (!user) {
            console.log("No user logged in, redirecting to login...");
            window.location.href = 'index.html';
        } else {
            console.log("Logged in:", user.email);
            handleUserSession(user);
        }
    });

    // --- Core Logic ---
    function handleUserSession(user) {
        db.ref('users/' + user.uid).once('value')
            .then(snapshot => {
                const data = snapshot.val();
                if (data) {
                    currentUserRole = data.role;
                    const homeRoom = data.roomId;

                    if (user.email === SUPER_ADMIN_EMAIL) {
                        currentUserRole = 'admin';
                    }

                    if (currentUserRole === 'admin') {
                        loadAdminDashboard();
                    } else {
                        loadRoomView(homeRoom);
                    }
                } else {
                    if (user.email === SUPER_ADMIN_EMAIL) {
                        currentUserRole = 'admin';
                        loadAdminDashboard();
                        return;
                    }
                    console.error("No user profile found");
                    auth.signOut(); // Will trigger redirect
                }
            });
    }

    function loadAdminDashboard() {
        adminView.style.display = 'block';
        roomView.style.display = 'none';
        btnBackAdmin.style.display = 'none';
        currentRoomDisplay.textContent = "Admin Control Panel";

        roomListContainer.innerHTML = '<p>Đang tải danh sách phòng...</p>';
        detachListeners();

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
                card.id = `room-card-${roomId}`;

                // Initial Structure
                card.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <i class="fa-solid fa-chalkboard-user"></i>
                        <span class="presence-dot" id="presence-dot-${roomId}" 
                              style="position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; 
                                     border-radius: 50%; background: #bdc3c7; border: 2px solid #fff; 
                                     box-shadow: 0 0 5px rgba(0,0,0,0.1);"></span>
                    </div>
                    <h3>${roomId}</h3>
                    <p id="presence-text-${roomId}" style="font-size: 0.8rem; color: #95a5a6; margin-top: 5px;">Trống</p>
                `;

                card.addEventListener('click', () => {
                    loadRoomView(roomId);
                });
                roomListContainer.appendChild(card);

                // Listen for Presence
                const presenceRef = db.ref(`Rooms/${roomId}/PhatHienNguoi`);
                const presenceCb = (snap) => {
                    const val = snap.val();
                    const isPresent = val == 1 || val === true || val === '1' || val === 'motion';

                    const dot = document.getElementById(`presence-dot-${roomId}`);
                    const text = document.getElementById(`presence-text-${roomId}`);

                    if (dot && text) {
                        if (isPresent) {
                            dot.style.background = '#00b894';
                            dot.style.boxShadow = '0 0 8px #00b894';
                            text.textContent = "Đang sử dụng";
                            text.style.color = '#00b894';
                            text.style.fontWeight = "600";
                        } else {
                            dot.style.background = '#bdc3c7';
                            dot.style.boxShadow = 'none';
                            text.textContent = "Trống";
                            text.style.color = '#95a5a6';
                            text.style.fontWeight = "400";
                        }
                    }
                };

                presenceRef.on('value', presenceCb);
                // Note: We should track these listeners to detach them later, 
                // but since this is inside the room list which regenerates, 
                // we might accumulate listeners if we are not careful. 
                // Ideally, 'activeListeners' clears everything on detachListeners(). 
                // But detachListeners() only clears what is IN activeListeners.
                // We must push these new listeners to activeListeners.
                activeListeners.push({ ref: presenceRef, event: 'value', callback: presenceCb });
            });
        };
        roomsRef.on('value', roomsCb);
        activeListeners.push({ ref: roomsRef, event: 'value', callback: roomsCb });
    }

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
        const basePath = `Rooms/${roomId}`;

        // 1. Connection
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
                    if (key === 'NhietDo') tempValue.textContent = val !== null ? val : '--';
                    if (key === 'AnhSang') lightValValue.textContent = val !== null ? val : '--';
                }
            };
            ref.on('value', cb);
            activeListeners.push({ ref: ref, event: 'value', callback: cb });
        });

        // 3. Devices
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
            speedRef.on('value', speedCb);
            activeListeners.push({ ref: speedRef, event: 'value', callback: speedCb });
        }

        // 4. Auto Mode
        const autoModeRef = db.ref(`${basePath}/CheDoTuDong`);

        // FORCE ENABLE AUTO MODE ON LOAD
        autoModeRef.set(true).catch(e => console.error("Auto Force Error", e));

        const autoModeCb = (snap) => {
            const isAuto = snap.val() === true;
            if (autoModeToggle) {
                autoModeToggle.checked = isAuto;
                // Toggle is now unlocked for everyone (but starts ON)
                autoModeToggle.disabled = false;
            }

            // Disable/Enable manual controls
            for (let i = 1; i <= DEVICE_COUNT; i++) {
                const lToggle = document.getElementById(`light-toggle-${i}`);
                const fToggle = document.getElementById(`fan-toggle-${i}`);
                if (lToggle) lToggle.disabled = isAuto;
                if (fToggle) fToggle.disabled = isAuto;
            }

            if (masterOn) masterOn.disabled = isAuto;
            if (masterOff) masterOff.disabled = isAuto;
        };
        autoModeRef.on('value', autoModeCb);
        activeListeners.push({ ref: autoModeRef, event: 'value', callback: autoModeCb });
    }

    // --- Actions ---
    function toggleLight(index, isOn) {
        if (!currentRoomId) return;

        // Optimistic UI Update
        updateLightUI(index, isOn);
        state.lights[index] = isOn; // Update local state immediately

        const val = isOn ? 1 : 0;
        db.ref(`Rooms/${currentRoomId}/Den${index}`).set(val)
            .catch(err => {
                showToast(`Lỗi: ` + err.message, 'error');
                // Revert on error
                updateLightUI(index, !isOn);
                state.lights[index] = !isOn;
                const toggle = document.getElementById(`light-toggle-${index}`);
                if (toggle) toggle.checked = !isOn;
            });
    }

    function toggleFan(index, isOn) {
        if (!currentRoomId) return;

        // Optimistic UI Update
        updateFanUI(index, isOn);
        state.fans[index] = isOn; // Update local state immediately

        const val = isOn ? 1 : 0;
        db.ref(`Rooms/${currentRoomId}/Quat${index}`).set(val)
            .catch(err => {
                showToast(`Lỗi: ` + err.message, 'error');
                // Revert on error
                updateFanUI(index, !isOn);
                state.fans[index] = !isOn;
                const toggle = document.getElementById(`fan-toggle-${index}`);
                if (toggle) toggle.checked = !isOn;
            });
    }

    function setFanSpeed(index, value) {
        if (!currentRoomId) return;
        // Speed slider is already somewhat optimistic via 'input' listener updating label
        // But we can update state immediately too
        state.fanSpeeds[index] = parseInt(value);
        updateFanAnimation(index);

        db.ref(`Rooms/${currentRoomId}/TocDoQuat${index}`).set(parseInt(value))
            .catch(err => console.error(err));
    }

    function turnAllOff() {
        if (!currentRoomId) return;

        // Optimistic Update
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            updateLightUI(i, false);
            updateFanUI(i, false);
            state.lights[i] = false;
            state.fans[i] = false;
            const lToggle = document.getElementById(`light-toggle-${i}`);
            const fToggle = document.getElementById(`fan-toggle-${i}`);
            if (lToggle) lToggle.checked = false;
            if (fToggle) fToggle.checked = false;
        }

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

        // Optimistic Update
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            updateLightUI(i, true);
            updateFanUI(i, true);
            state.lights[i] = true;
            state.fans[i] = true;
            const lToggle = document.getElementById(`light-toggle-${i}`);
            const fToggle = document.getElementById(`fan-toggle-${i}`);
            if (lToggle) lToggle.checked = true;
            if (fToggle) fToggle.checked = true;
        }

        const updates = {};
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            updates[`Rooms/${currentRoomId}/Den${i}`] = 1;
            updates[`Rooms/${currentRoomId}/Quat${i}`] = 1;
        }
        db.ref().update(updates)
            .then(() => showToast('Đã bật tất cả (Phòng ' + currentRoomId + ')', 'success'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    // UI Updates
    function updateLightUI(index, isOn) {
        const statusEl = document.getElementById(`light-status-${index}`);
        const card = document.getElementById(`card-light-${index}`);
        if (statusEl) statusEl.textContent = isOn ? 'Đang Bật' : 'Đang Tắt';
        if (isOn && card) card.classList.add('active');
        else if (card) card.classList.remove('active');
    }

    function updateFanUI(index, isOn) {
        const statusEl = document.getElementById(`fan-status-${index}`);
        const card = document.getElementById(`card-fan-${index}`);
        if (statusEl) statusEl.textContent = isOn ? 'Đang Bật' : 'Đang Tắt';
        if (card) {
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
        if (!container) return;
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

    // --- Inputs ---
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    if (btnBackAdmin) {
        btnBackAdmin.addEventListener('click', () => {
            if (currentUserRole === 'admin') loadAdminDashboard();
        });
    }

    if (masterOff) masterOff.addEventListener('click', turnAllOff);
    if (masterOn) masterOn.addEventListener('click', turnAllOn);

    if (autoModeToggle) {
        autoModeToggle.addEventListener('change', (e) => {
            if (!currentRoomId) return;
            const isAuto = e.target.checked;
            db.ref(`Rooms/${currentRoomId}/CheDoTuDong`).set(isAuto)
                .catch(err => showToast(`Lỗi: ` + err.message, 'error'));
        });
    }

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
});
