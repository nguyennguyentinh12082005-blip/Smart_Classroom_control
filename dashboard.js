document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const auth = firebase.auth();

    // --- DOM Elements ---
    // Views
    const adminDashboardView = document.getElementById('admin-dashboard-view');
    const roomsView = document.getElementById('rooms-view');
    const roomControlView = document.getElementById('room-control-view');
    const statisticsView = document.getElementById('statistics-view');

    // Navigation
    const navDashboard = document.getElementById('nav-dashboard');
    const navRooms = document.getElementById('nav-rooms');
    const navStatistics = document.getElementById('nav-statistics');
    const navSettings = document.getElementById('nav-settings');
    const allNavItems = document.querySelectorAll('.nav-item:not(.logout)');

    // Header
    const pageTitle = document.getElementById('page-title');
    const currentRoomDisplay = document.getElementById('current-room-display');
    const connectionStatus = document.getElementById('connection-status');
    const logoutBtn = document.getElementById('logout-btn');

    // Room List
    const roomListContainer = document.getElementById('room-list');
    const roomStatusGrid = document.getElementById('room-status-grid');
    const btnBackRooms = document.getElementById('btn-back-rooms');

    // Admin Overview
    const totalRoomsEl = document.getElementById('total-rooms');
    const activeRoomsEl = document.getElementById('active-rooms');
    const avgTempEl = document.getElementById('avg-temp');
    const avgHumidityEl = document.getElementById('avg-humidity');

    // Controls
    const masterOff = document.getElementById('master-off');
    const masterOn = document.getElementById('master-on');
    const autoModeToggle = document.getElementById('auto-mode-toggle');

    // Sensors
    const tempValue = document.getElementById('temp-value');
    const humidityValue = document.getElementById('humidity-value');
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
    let roomsData = {};

    // Charts
    let tempChart = null;
    let humidityChart = null;
    let lightChart = null;
    let usageChart = null;

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

                    currentRoomDisplay.textContent = user.email.split('@')[0];

                    if (currentUserRole === 'admin') {
                        showView('dashboard');
                        loadAdminData();
                    } else {
                        // Non-admin goes directly to their room
                        hideNavForNonAdmin();
                        loadRoomControl(homeRoom);
                    }
                } else {
                    if (user.email === SUPER_ADMIN_EMAIL) {
                        currentUserRole = 'admin';
                        currentRoomDisplay.textContent = 'Admin';
                        showView('dashboard');
                        loadAdminData();
                        return;
                    }
                    console.error("No user profile found");
                    auth.signOut();
                }
            });
    }

    function hideNavForNonAdmin() {
        navDashboard.style.display = 'none';
        navRooms.style.display = 'none';
        navStatistics.style.display = 'none';
        navSettings.style.display = 'none';
    }

    // --- View Management ---
    function showView(viewName) {
        // Hide all views
        adminDashboardView.style.display = 'none';
        roomsView.style.display = 'none';
        roomControlView.style.display = 'none';
        statisticsView.style.display = 'none';

        // Update active nav
        allNavItems.forEach(item => item.classList.remove('active'));

        switch (viewName) {
            case 'dashboard':
                adminDashboardView.style.display = 'block';
                navDashboard.classList.add('active');
                pageTitle.textContent = 'Dashboard';
                break;
            case 'rooms':
                roomsView.style.display = 'block';
                navRooms.classList.add('active');
                pageTitle.textContent = 'Phòng Học';
                break;
            case 'room-control':
                roomControlView.style.display = 'block';
                navRooms.classList.add('active');
                pageTitle.textContent = 'Điều Khiển Phòng - ' + currentRoomId;
                break;
            case 'statistics':
                statisticsView.style.display = 'block';
                navStatistics.classList.add('active');
                pageTitle.textContent = 'Thống Kê';
                loadStatistics();
                break;
        }
    }

    // --- Admin Data ---
    function loadAdminData() {
        detachListeners();

        const roomsRef = db.ref('Rooms');
        const roomsCb = (snapshot) => {
            roomsData = snapshot.val() || {};
            updateAdminOverview();
            updateRoomStatusGrid();
            updateRoomsList();
        };
        roomsRef.on('value', roomsCb);
        activeListeners.push({ ref: roomsRef, event: 'value', callback: roomsCb });

        // Connection status
        const connectedRef = db.ref(".info/connected");
        const connectedCb = (snap) => {
            if (snap.val() === true) {
                connectionStatus.style.opacity = '1';
                connectionStatus.querySelector('span').textContent = 'Đã kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#27AE60';
            } else {
                connectionStatus.style.opacity = '0.7';
                connectionStatus.querySelector('span').textContent = 'Mất kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#E74C3C';
            }
        };
        connectedRef.on("value", connectedCb);
        activeListeners.push({ ref: connectedRef, event: "value", callback: connectedCb });
    }

    function updateAdminOverview() {
        const roomKeys = Object.keys(roomsData);
        const totalRooms = roomKeys.length;
        let activeRooms = 0;
        let totalTemp = 0;
        let totalHumidity = 0;
        let tempCount = 0;
        let humidityCount = 0;

        roomKeys.forEach(roomId => {
            const room = roomsData[roomId];

            // Check presence
            const presence = room.PhatHienNguoi;
            if (presence == 1 || presence === true || presence === '1') {
                activeRooms++;
            }

            // Sum temperature
            if (room.NhietDo !== undefined && room.NhietDo !== null) {
                totalTemp += parseFloat(room.NhietDo);
                tempCount++;
            }

            // Sum humidity
            if (room.DoAm !== undefined && room.DoAm !== null) {
                totalHumidity += parseFloat(room.DoAm);
                humidityCount++;
            }
        });

        totalRoomsEl.textContent = totalRooms;
        activeRoomsEl.textContent = activeRooms;
        avgTempEl.textContent = tempCount > 0 ? (totalTemp / tempCount).toFixed(1) : '--';
        avgHumidityEl.textContent = humidityCount > 0 ? (totalHumidity / humidityCount).toFixed(0) : '--';
    }

    function updateRoomStatusGrid() {
        const roomKeys = Object.keys(roomsData);
        roomStatusGrid.innerHTML = '';

        if (roomKeys.length === 0) {
            roomStatusGrid.innerHTML = '<p style="color: #7F8C8D;">Chưa có phòng nào.</p>';
            return;
        }

        roomKeys.forEach(roomId => {
            const room = roomsData[roomId];
            const isActive = room.PhatHienNguoi == 1 || room.PhatHienNguoi === true;

            const card = document.createElement('div');
            card.className = `room-status-card ${isActive ? 'active' : ''}`;
            card.innerHTML = `
                <div class="room-status-header">
                    <span class="room-name">${roomId}</span>
                    <span class="room-status-dot ${isActive ? 'active' : ''}"></span>
                </div>
                <div class="room-status-info">
                    <div class="info-item">
                        <i class="fa-solid fa-temperature-half"></i>
                        <span>${room.NhietDo || '--'}°C</span>
                    </div>
                    <div class="info-item">
                        <i class="fa-solid fa-droplet"></i>
                        <span>${room.DoAm || '--'}%</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                loadRoomControl(roomId);
            });
            roomStatusGrid.appendChild(card);
        });
    }

    function updateRoomsList() {
        const roomKeys = Object.keys(roomsData);
        roomListContainer.innerHTML = '';

        if (roomKeys.length === 0) {
            roomListContainer.innerHTML = '<p style="color: #7F8C8D;">Chưa có phòng nào được tạo.</p>';
            return;
        }

        roomKeys.forEach(roomId => {
            const room = roomsData[roomId];
            const isActive = room.PhatHienNguoi == 1 || room.PhatHienNguoi === true;

            const card = document.createElement('div');
            card.className = 'room-card';
            card.innerHTML = `
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-chalkboard-user"></i>
                    <span class="presence-dot ${isActive ? 'active' : ''}"></span>
                </div>
                <h3>${roomId}</h3>
                <p class="room-status-text">${isActive ? 'Đang sử dụng' : 'Trống'}</p>
            `;
            card.addEventListener('click', () => {
                loadRoomControl(roomId);
            });
            roomListContainer.appendChild(card);
        });
    }

    // --- Room Control ---
    function loadRoomControl(roomId) {
        currentRoomId = roomId;
        showView('room-control');

        if (currentUserRole === 'admin') {
            btnBackRooms.style.display = 'flex';
        } else {
            btnBackRooms.style.display = 'none';
        }

        setupDeviceListeners(roomId);
    }

    function setupDeviceListeners(roomId) {
        detachListeners();
        const basePath = `Rooms/${roomId}`;

        // Connection
        const connectedRef = db.ref(".info/connected");
        const connectedCb = (snap) => {
            if (snap.val() === true) {
                connectionStatus.style.opacity = '1';
                connectionStatus.querySelector('span').textContent = 'Đã kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#27AE60';
            } else {
                connectionStatus.style.opacity = '0.7';
                connectionStatus.querySelector('span').textContent = 'Mất kết nối';
                connectionStatus.querySelector('.status-dot').style.backgroundColor = '#E74C3C';
            }
        };
        connectedRef.on("value", connectedCb);
        activeListeners.push({ ref: connectedRef, event: "value", callback: connectedCb });

        // Sensors
        const sensorMap = {
            'NhietDo': tempValue,
            'DoAm': humidityValue,
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
                    presenceValue.style.color = hasMotion ? '#27AE60' : '#E74C3C';
                } else {
                    if (key === 'NhietDo') {
                        tempValue.textContent = val !== null ? val : '--';
                        const progress = Math.min(100, (val / 50) * 100);
                        updateCircularProgress('temp-progress', progress);
                    }
                    if (key === 'DoAm') {
                        humidityValue.textContent = val !== null ? val : '--';
                        updateCircularProgress('humidity-progress', val || 0);
                    }
                    if (key === 'AnhSang') {
                        lightValValue.textContent = val !== null ? val : '--';
                        const progress = Math.min(100, (val / 1000) * 100);
                        updateCircularProgress('light-progress', progress);
                    }
                }
            };
            ref.on('value', cb);
            activeListeners.push({ ref: ref, event: 'value', callback: cb });
        });

        // Devices
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

        // Auto Mode
        const autoModeRef = db.ref(`${basePath}/CheDoTuDong`);
        autoModeRef.set(true).catch(e => console.error("Auto Force Error", e));

        const autoModeCb = (snap) => {
            const isAuto = snap.val() === true;
            if (autoModeToggle) {
                autoModeToggle.checked = isAuto;
                autoModeToggle.disabled = false;
            }

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

    function detachListeners() {
        activeListeners.forEach(l => l.ref.off(l.event, l.callback));
        activeListeners = [];
    }

    // --- Statistics ---
    function loadStatistics() {
        const roomKeys = Object.keys(roomsData);
        const labels = roomKeys;
        const temps = [];
        const humidities = [];
        const lights = [];
        const usageData = [];

        roomKeys.forEach(roomId => {
            const room = roomsData[roomId];
            temps.push(room.NhietDo || 0);
            humidities.push(room.DoAm || 0);
            lights.push(room.AnhSang || 0);
            usageData.push(room.PhatHienNguoi == 1 || room.PhatHienNguoi === true ? 1 : 0);
        });

        // Destroy existing charts
        if (tempChart) tempChart.destroy();
        if (humidityChart) humidityChart.destroy();
        if (lightChart) lightChart.destroy();
        if (usageChart) usageChart.destroy();

        // Temperature Chart
        const tempCtx = document.getElementById('tempChart').getContext('2d');
        tempChart = new Chart(tempCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nhiệt Độ (°C)',
                    data: temps,
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    borderColor: '#E74C3C',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 50 } }
            }
        });

        // Humidity Chart
        const humidityCtx = document.getElementById('humidityChart').getContext('2d');
        humidityChart = new Chart(humidityCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Độ Ẩm (%)',
                    data: humidities,
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: '#3498DB',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });

        // Light Chart
        const lightCtx = document.getElementById('lightChart').getContext('2d');
        lightChart = new Chart(lightCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ánh Sáng (Lux)',
                    data: lights,
                    backgroundColor: 'rgba(241, 196, 15, 0.7)',
                    borderColor: '#F1C40F',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });

        // Usage Chart (Pie)
        const usageCtx = document.getElementById('usageChart').getContext('2d');
        const activeCount = usageData.filter(v => v === 1).length;
        const inactiveCount = usageData.length - activeCount;
        usageChart = new Chart(usageCtx, {
            type: 'doughnut',
            data: {
                labels: ['Đang Sử Dụng', 'Trống'],
                datasets: [{
                    data: [activeCount, inactiveCount],
                    backgroundColor: ['#27AE60', '#BDC3C7'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // --- Actions ---
    function toggleLight(index, isOn) {
        if (!currentRoomId) return;
        updateLightUI(index, isOn);
        state.lights[index] = isOn;

        const val = isOn ? 1 : 0;
        db.ref(`Rooms/${currentRoomId}/Den${index}`).set(val)
            .catch(err => {
                showToast(`Lỗi: ` + err.message, 'error');
                updateLightUI(index, !isOn);
                state.lights[index] = !isOn;
                const toggle = document.getElementById(`light-toggle-${index}`);
                if (toggle) toggle.checked = !isOn;
            });
    }

    function toggleFan(index, isOn) {
        if (!currentRoomId) return;
        updateFanUI(index, isOn);
        state.fans[index] = isOn;

        const val = isOn ? 1 : 0;
        db.ref(`Rooms/${currentRoomId}/Quat${index}`).set(val)
            .catch(err => {
                showToast(`Lỗi: ` + err.message, 'error');
                updateFanUI(index, !isOn);
                state.fans[index] = !isOn;
                const toggle = document.getElementById(`fan-toggle-${index}`);
                if (toggle) toggle.checked = !isOn;
            });
    }

    function setFanSpeed(index, value) {
        if (!currentRoomId) return;
        state.fanSpeeds[index] = parseInt(value);
        updateFanAnimation(index);

        db.ref(`Rooms/${currentRoomId}/TocDoQuat${index}`).set(parseInt(value))
            .catch(err => console.error(err));
    }

    function turnAllOff() {
        if (!currentRoomId) return;
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
            .then(() => showToast('Đã tắt tất cả'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function turnAllOn() {
        if (!currentRoomId) return;
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
            .then(() => showToast('Đã bật tất cả', 'success'))
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

    function updateCircularProgress(elementId, percent) {
        const progressBar = document.getElementById(elementId);
        if (progressBar) {
            const value = Math.max(0, Math.min(100, percent));
            progressBar.setAttribute('stroke-dasharray', `${value}, 100`);
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

    // --- Event Listeners ---
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    // Navigation
    if (navDashboard) navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        showView('dashboard');
        loadAdminData();
    });

    if (navRooms) navRooms.addEventListener('click', (e) => {
        e.preventDefault();
        showView('rooms');
    });

    if (navStatistics) navStatistics.addEventListener('click', (e) => {
        e.preventDefault();
        showView('statistics');
    });

    if (btnBackRooms) btnBackRooms.addEventListener('click', () => {
        showView('rooms');
    });

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
