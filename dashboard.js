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
        fans: [false, false, false]
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

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        // Create toast element
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(toast);
        }

        // Set color based on type
        const colors = {
            success: '#27AE60',
            error: '#E74C3C',
            info: '#3498DB'
        };
        toast.style.backgroundColor = colors[type] || colors.info;
        toast.textContent = message;
        toast.style.opacity = '1';

        // Hide after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

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
        // Get settings view
        const settingsView = document.getElementById('settings-view');

        // Hide all views
        adminDashboardView.style.display = 'none';
        roomsView.style.display = 'none';
        roomControlView.style.display = 'none';
        statisticsView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'none';

        // Update active nav
        allNavItems.forEach(item => item.classList.remove('active'));

        switch (viewName) {
            case 'dashboard':
                adminDashboardView.style.display = 'block';
                navDashboard.classList.add('active');
                pageTitle.textContent = getTranslation('navDashboard');
                break;
            case 'rooms':
                roomsView.style.display = 'block';
                navRooms.classList.add('active');
                pageTitle.textContent = getTranslation('navRooms');
                break;
            case 'room-control':
                roomControlView.style.display = 'block';
                navRooms.classList.add('active');
                pageTitle.textContent = getTranslation('roomControl') + ' - ' + currentRoomId;
                break;
            case 'statistics':
                statisticsView.style.display = 'block';
                navStatistics.classList.add('active');
                pageTitle.textContent = getTranslation('navStatistics');
                loadStatistics();
                break;
            case 'settings':
                if (settingsView) settingsView.style.display = 'block';
                navSettings.classList.add('active');
                pageTitle.textContent = getTranslation('navSettings');
                loadSettings();
                break;
        }
    }

    // Translation helper - returns translation for current language
    function getTranslation(key) {
        const lang = localStorage.getItem('language') || 'vi';
        const trans = {
            navDashboard: lang === 'vi' ? 'Bảng điều khiển' : 'Dashboard',
            navRooms: lang === 'vi' ? 'Phòng học' : 'Rooms',
            navStatistics: lang === 'vi' ? 'Thống kê' : 'Statistics',
            navSettings: lang === 'vi' ? 'Cài đặt' : 'Settings',
            roomControl: lang === 'vi' ? 'Điều Khiển Phòng' : 'Room Control'
        };
        return trans[key] || key;
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
            const presence = room.ChuyenDong;
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
            const isActive = room.ChuyenDong == 1 || room.ChuyenDong === true;

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
            const isActive = room.ChuyenDong == 1 || room.ChuyenDong === true;

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
            'ChuyenDong': presenceValue,
            'AnhSang': lightValValue
        };

        Object.keys(sensorMap).forEach(key => {
            const ref = db.ref(`${basePath}/${key}`);
            const cb = (snap) => {
                const val = snap.val();
                const el = sensorMap[key];
                if (!el) return;

                if (key === 'ChuyenDong') {
                    console.log('[DEBUG] ChuyenDong value from Firebase:', val, 'Type:', typeof val);
                    const hasMotion = val == 1 || val === true || val === '1' || val === 'motion';
                    console.log('[DEBUG] hasMotion calculated:', hasMotion);
                    if (presenceValue) {
                        presenceValue.textContent = hasMotion ? 'Có' : 'Không';
                        presenceValue.style.color = hasMotion ? '#27AE60' : '#E74C3C';
                    }

                    // Disable/Enable all device toggles based on presence
                    for (let i = 1; i <= DEVICE_COUNT; i++) {
                        const lToggle = document.getElementById(`light-toggle-${i}`);
                        const fToggle = document.getElementById(`fan-toggle-${i}`);
                        if (lToggle) lToggle.disabled = !hasMotion;
                        if (fToggle) fToggle.disabled = !hasMotion;
                    }
                    // Disable/Enable master buttons
                    if (masterOn) masterOn.disabled = !hasMotion;
                    if (masterOff) masterOff.disabled = !hasMotion;
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

        // Devices - Listen to both command values and actual values
        for (let i = 1; i <= DEVICE_COUNT; i++) {
            // Lights - command values (for manual mode)
            const lightRef = db.ref(`${basePath}/Den${i}`);
            const lightCb = (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                state.lights[i] = isOn;
                // Only update UI if NOT in auto mode
                if (!autoModeToggle || !autoModeToggle.checked) {
                    const toggle = document.getElementById(`light-toggle-${i}`);
                    if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                    updateLightUI(i, isOn);
                }
            };
            lightRef.on('value', lightCb);
            activeListeners.push({ ref: lightRef, event: 'value', callback: lightCb });

            // Lights - ACTUAL values (for auto mode display)
            const actualLightRef = db.ref(`${basePath}/ActualDen${i}`);
            const actualLightCb = (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                // Only update UI if in auto mode
                if (autoModeToggle && autoModeToggle.checked) {
                    const toggle = document.getElementById(`light-toggle-${i}`);
                    if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                    updateLightUI(i, isOn);
                }
            };
            actualLightRef.on('value', actualLightCb);
            activeListeners.push({ ref: actualLightRef, event: 'value', callback: actualLightCb });

            // Fans - command values (for manual mode)
            const fanRef = db.ref(`${basePath}/Quat${i}`);
            const fanCb = (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                state.fans[i] = isOn;
                // Only update UI if NOT in auto mode
                if (!autoModeToggle || !autoModeToggle.checked) {
                    const toggle = document.getElementById(`fan-toggle-${i}`);
                    if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                    updateFanUI(i, isOn);
                }
            };
            fanRef.on('value', fanCb);
            activeListeners.push({ ref: fanRef, event: 'value', callback: fanCb });

            // Fans - ACTUAL values (for auto mode display)
            const actualFanRef = db.ref(`${basePath}/ActualQuat${i}`);
            const actualFanCb = (snap) => {
                const isOn = snap.val() == 1 || snap.val() === true;
                // Only update UI if in auto mode
                if (autoModeToggle && autoModeToggle.checked) {
                    const toggle = document.getElementById(`fan-toggle-${i}`);
                    if (toggle && toggle.checked !== isOn) toggle.checked = isOn;
                    updateFanUI(i, isOn);
                }
            };
            actualFanRef.on('value', actualFanCb);
            activeListeners.push({ ref: actualFanRef, event: 'value', callback: actualFanCb });
        }

        // Auto Mode - just listen, don't force to true
        const autoModeRef = db.ref(`${basePath}/AutoMode`);

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

            // When switching modes, force refresh actual values
            if (isAuto) {
                // Read actual values immediately when switching to AUTO
                for (let i = 1; i <= DEVICE_COUNT; i++) {
                    db.ref(`${basePath}/ActualDen${i}`).once('value', (s) => {
                        const isOn = s.val() == 1;
                        const toggle = document.getElementById(`light-toggle-${i}`);
                        if (toggle) toggle.checked = isOn;
                        updateLightUI(i, isOn);
                    });
                    db.ref(`${basePath}/ActualQuat${i}`).once('value', (s) => {
                        const isOn = s.val() == 1;
                        const toggle = document.getElementById(`fan-toggle-${i}`);
                        if (toggle) toggle.checked = isOn;
                        updateFanUI(i, isOn);
                    });
                }
            }
        };
        autoModeRef.on('value', autoModeCb);
        activeListeners.push({ ref: autoModeRef, event: 'value', callback: autoModeCb });
    }

    function detachListeners() {
        activeListeners.forEach(l => l.ref.off(l.event, l.callback));
        activeListeners = [];
    }

    // --- Device Control Functions ---
    // (defined later in the file with optimistic UI updates)

    // --- Statistics ---
    function loadStatistics() {
        // Fetch rooms data directly from Firebase
        db.ref('Rooms').once('value').then(snapshot => {
            const rooms = snapshot.val() || {};
            const roomKeys = Object.keys(rooms);

            if (roomKeys.length === 0) {
                // No data available
                const container = document.querySelector('.stats-charts-grid');
                if (container) {
                    container.innerHTML = '<p style="color: #7F8C8D; padding: 20px;">Chưa có dữ liệu phòng để thống kê.</p>';
                }
                return;
            }

            const labels = roomKeys;
            const temps = [];
            const humidities = [];
            const lights = [];
            const usageData = [];

            roomKeys.forEach(roomId => {
                const room = rooms[roomId];
                temps.push(room.NhietDo || 0);
                humidities.push(room.DoAm || 0);
                lights.push(room.AnhSang || 0);
                usageData.push(room.ChuyenDong == 1 || room.ChuyenDong === true ? 1 : 0);
            });

            // Destroy existing charts
            if (tempChart) tempChart.destroy();
            if (humidityChart) humidityChart.destroy();
            if (lightChart) lightChart.destroy();
            if (usageChart) usageChart.destroy();

            // Temperature Chart
            const tempCtx = document.getElementById('tempChart');
            if (tempCtx) {
                tempChart = new Chart(tempCtx.getContext('2d'), {
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
            }

            // Humidity Chart
            const humidityCtx = document.getElementById('humidityChart');
            if (humidityCtx) {
                humidityChart = new Chart(humidityCtx.getContext('2d'), {
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
            }

            // Light Chart
            const lightCtx = document.getElementById('lightChart');
            if (lightCtx) {
                lightChart = new Chart(lightCtx.getContext('2d'), {
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
            }

            // Usage Chart (Pie)
            const usageCtx = document.getElementById('usageChart');
            if (usageCtx) {
                const activeCount = usageData.filter(v => v === 1).length;
                const inactiveCount = usageData.length - activeCount;
                usageChart = new Chart(usageCtx.getContext('2d'), {
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
        }).catch(err => {
            console.error('Error loading statistics:', err);
            showToast('Lỗi tải thống kê: ' + err.message, 'error');
        });
    }

    // --- Settings ---
    function loadSettings() {
        // Load user info
        const user = auth.currentUser;
        const settingsEmail = document.getElementById('settings-email');
        const settingsRole = document.getElementById('settings-role');
        const roomManagementCard = document.getElementById('room-management-card');

        if (settingsEmail) {
            settingsEmail.textContent = user.email;
        }
        if (settingsRole) {
            settingsRole.textContent = currentUserRole === 'admin' ? 'Quản trị viên' : 'Người dùng';
        }

        // Show/hide admin-only features
        if (roomManagementCard) {
            roomManagementCard.style.display = currentUserRole === 'admin' ? 'block' : 'none';
        }

        const userManagementCard = document.getElementById('user-management-card');
        if (userManagementCard) {
            userManagementCard.style.display = currentUserRole === 'admin' ? 'block' : 'none';
        }

        // Load room list and user list for admin
        if (currentUserRole === 'admin') {
            loadRoomListForManagement();
            loadUserList();
        }

        // Load saved settings
        db.ref('Settings').once('value').then(snapshot => {
            const settings = snapshot.val() || {};
            const tempThreshold = document.getElementById('temp-threshold');
            const humidityThreshold = document.getElementById('humidity-threshold');
            const autoOffToggle = document.getElementById('auto-off-toggle');
            const notifyTemp = document.getElementById('notify-temp');
            const notifyHumidity = document.getElementById('notify-humidity');
            const notifyPresence = document.getElementById('notify-presence');

            if (tempThreshold && settings.tempThreshold) {
                tempThreshold.value = settings.tempThreshold;
            }
            if (humidityThreshold && settings.humidityThreshold) {
                humidityThreshold.value = settings.humidityThreshold;
            }
            if (autoOffToggle && settings.autoOff !== undefined) {
                autoOffToggle.checked = settings.autoOff;
            }

            // Load notification settings
            if (settings.notifications) {
                if (notifyTemp) notifyTemp.checked = settings.notifications.temp !== false;
                if (notifyHumidity) notifyHumidity.checked = settings.notifications.humidity !== false;
                if (notifyPresence) notifyPresence.checked = settings.notifications.presence === true;
            }
        });
    }

    function loadRoomListForManagement() {
        const container = document.getElementById('room-list-manage');
        if (!container) return;

        db.ref('Rooms').once('value').then(snapshot => {
            const rooms = snapshot.val() || {};
            const roomKeys = Object.keys(rooms);

            container.innerHTML = '';

            if (roomKeys.length === 0) {
                container.innerHTML = '<p style="color: #7F8C8D;">Chưa có phòng nào.</p>';
                return;
            }

            roomKeys.forEach(roomId => {
                const item = document.createElement('div');
                item.className = 'room-manage-item';
                item.innerHTML = `
                    <span class="room-manage-name">${roomId}</span>
                    <button class="btn-delete-room" data-room="${roomId}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
                container.appendChild(item);
            });

            // Add delete event listeners
            container.querySelectorAll('.btn-delete-room').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const roomId = e.currentTarget.dataset.room;
                    if (confirm(`Bạn có chắc muốn xóa phòng ${roomId}?`)) {
                        deleteRoom(roomId);
                    }
                });
            });
        });
    }

    function addRoom(roomId) {
        if (!roomId || roomId.trim() === '') {
            showToast('Vui lòng nhập mã phòng', 'error');
            return;
        }

        const cleanRoomId = roomId.trim().toUpperCase();

        // Create room with default values
        const defaultRoomData = {
            NhietDo: 25,
            DoAm: 60,
            AnhSang: 300,
            PhatHienNguoi: 0,
            CheDoTuDong: true,
            Den1: 0, Den2: 0, Den3: 0,
            Quat1: 0, Quat2: 0, Quat3: 0,
            TocDoQuat1: 50, TocDoQuat2: 50, TocDoQuat3: 50
        };

        db.ref(`Rooms/${cleanRoomId}`).set(defaultRoomData)
            .then(() => {
                showToast(`Đã thêm phòng ${cleanRoomId}`, 'success');
                document.getElementById('new-room-id').value = '';
                loadRoomListForManagement();
            })
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function deleteRoom(roomId) {
        db.ref(`Rooms/${roomId}`).remove()
            .then(() => {
                showToast(`Đã xóa phòng ${roomId}`, 'success');
                loadRoomListForManagement();
            })
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function saveSettings() {
        const tempThreshold = document.getElementById('temp-threshold');
        const humidityThreshold = document.getElementById('humidity-threshold');
        const autoOffToggle = document.getElementById('auto-off-toggle');
        const notifyTemp = document.getElementById('notify-temp');
        const notifyHumidity = document.getElementById('notify-humidity');
        const notifyPresence = document.getElementById('notify-presence');

        const settings = {
            tempThreshold: tempThreshold ? parseInt(tempThreshold.value) : 35,
            humidityThreshold: humidityThreshold ? parseInt(humidityThreshold.value) : 80,
            autoOff: autoOffToggle ? autoOffToggle.checked : true,
            notifications: {
                temp: notifyTemp ? notifyTemp.checked : true,
                humidity: notifyHumidity ? notifyHumidity.checked : true,
                presence: notifyPresence ? notifyPresence.checked : false
            }
        };

        db.ref('Settings').set(settings)
            .then(() => showToast(translations[currentLanguage].settingsSaved || 'Đã lưu cài đặt', 'success'))
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    // --- Language / i18n ---
    let currentLanguage = localStorage.getItem('language') || 'vi';

    const translations = {
        vi: {
            // Navigation
            navDashboard: 'Bảng điều khiển',
            navRooms: 'Phòng học',
            navStatistics: 'Thống kê',
            navSettings: 'Cài đặt',
            logout: 'Đăng xuất',
            schoolName: 'ĐH Công nghệ Kỹ thuật TP.HCM',
            pageSubtitle: 'Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh',
            searchPlaceholder: 'Tìm kiếm...',
            connected: 'Đã kết nối',
            loading: 'Đang tải...',

            // Dashboard Overview
            totalRooms: 'Tổng Phòng',
            inUse: 'Đang Sử Dụng',
            avgTemp: 'Nhiệt Độ TB (°C)',
            avgHumidity: 'Độ Ẩm TB (%)',
            roomStatus: 'Trạng Thái Phòng Học',
            roomList: 'Danh Sách Phòng Học',

            // Room Control
            backToList: 'Quay lại danh sách',
            temperature: 'Nhiệt Độ',
            humidity: 'Độ Ẩm',
            light: 'Ánh Sáng',
            presence: 'Đang Sử Dụng',
            autoMode: 'Chế độ tự động',
            turnOnAll: 'Bật Tất Cả',
            turnOffAll: 'Tắt Tất Cả',
            lightSystem: 'Hệ Thống Đèn',
            fanSystem: 'Hệ Thống Quạt',
            light1: 'Đèn 1', light2: 'Đèn 2', light3: 'Đèn 3',
            fan1: 'Quạt 1', fan2: 'Quạt 2', fan3: 'Quạt 3',
            on: 'Đang Bật',
            off: 'Đang Tắt',
            fanSpeed: 'Tốc độ gió',
            yes: 'Có',
            no: 'Không',

            // Statistics
            tempByRoom: 'Nhiệt Độ Theo Phòng',
            humidityByRoom: 'Độ Ẩm Theo Phòng',
            lightByRoom: 'Ánh Sáng Theo Phòng (Lux)',
            roomUsage: 'Tình Trạng Sử Dụng Phòng',

            // Settings
            profile: 'Thông Tin Tài Khoản',
            changePassword: 'Đổi Mật Khẩu',
            appearance: 'Giao Diện',
            language: 'Ngôn ngữ',
            languageDesc: 'Chọn ngôn ngữ hiển thị',
            theme: 'Chế độ giao diện',
            themeDesc: 'Sáng hoặc tối',
            notifications: 'Thông Báo',
            tempAlert: 'Cảnh báo nhiệt độ cao',
            tempAlertDesc: 'Thông báo khi nhiệt độ vượt ngưỡng',
            humidityAlert: 'Cảnh báo độ ẩm cao',
            humidityAlertDesc: 'Thông báo khi độ ẩm vượt ngưỡng',
            presenceAlert: 'Thông báo phát hiện người',
            presenceAlertDesc: 'Thông báo khi có người vào phòng',
            roomManagement: 'Quản Lý Phòng Học',
            addRoom: 'Thêm Phòng',
            userManagement: 'Quản Lý Người Dùng',
            addUser: 'Thêm',
            systemSettings: 'Cài Đặt Hệ Thống',
            tempThreshold: 'Ngưỡng nhiệt độ cảnh báo',
            tempThresholdDesc: 'Cảnh báo khi nhiệt độ vượt ngưỡng',
            humidityThreshold: 'Ngưỡng độ ẩm cảnh báo',
            humidityThresholdDesc: 'Cảnh báo khi độ ẩm vượt ngưỡng',
            autoOff: 'Tự động tắt thiết bị',
            autoOffDesc: 'Tắt tất cả khi không có người',
            saveSettings: 'Lưu Cài Đặt',
            about: 'Thông Tin',
            settingsSaved: 'Đã lưu cài đặt',
            userAdded: 'Đã thêm người dùng',
            userDeleted: 'Đã xóa người dùng',
            admin: 'Quản trị viên',
            user: 'Người dùng',
            selectRoom: 'Chọn phòng...',
            noRooms: 'Chưa có phòng nào.',
            noUsers: 'Chưa có người dùng nào.',
            confirmDeleteRoom: 'Bạn có chắc muốn xóa phòng',
            confirmDeleteUser: 'Bạn có chắc muốn xóa người dùng này?',
            roomAdded: 'Đã thêm phòng',
            roomDeleted: 'Đã xóa phòng',
            enterRoomId: 'Vui lòng nhập mã phòng',
            enterEmailRoom: 'Vui lòng nhập email và chọn phòng',
            passwordResetSent: 'Email đổi mật khẩu đã được gửi!'
        },
        en: {
            // Navigation
            navDashboard: 'Dashboard',
            navRooms: 'Rooms',
            navStatistics: 'Statistics',
            navSettings: 'Settings',
            logout: 'Logout',
            schoolName: 'HCMC University of Technology and Education',
            pageSubtitle: 'Ho Chi Minh City University of Technology and Education',
            searchPlaceholder: 'Search...',
            connected: 'Connected',
            loading: 'Loading...',

            // Dashboard Overview
            totalRooms: 'Total Rooms',
            inUse: 'In Use',
            avgTemp: 'Avg Temp (°C)',
            avgHumidity: 'Avg Humidity (%)',
            roomStatus: 'Room Status',
            roomList: 'Room List',

            // Room Control
            backToList: 'Back to list',
            temperature: 'Temperature',
            humidity: 'Humidity',
            light: 'Light',
            presence: 'In Use',
            autoMode: 'Auto mode',
            turnOnAll: 'Turn On All',
            turnOffAll: 'Turn Off All',
            lightSystem: 'Lighting System',
            fanSystem: 'Fan System',
            light1: 'Light 1', light2: 'Light 2', light3: 'Light 3',
            fan1: 'Fan 1', fan2: 'Fan 2', fan3: 'Fan 3',
            on: 'On',
            off: 'Off',
            fanSpeed: 'Fan speed',
            yes: 'Yes',
            no: 'No',

            // Statistics
            tempByRoom: 'Temperature by Room',
            humidityByRoom: 'Humidity by Room',
            lightByRoom: 'Light by Room (Lux)',
            roomUsage: 'Room Usage Status',

            // Settings
            profile: 'Account Information',
            changePassword: 'Change Password',
            appearance: 'Appearance',
            language: 'Language',
            languageDesc: 'Select display language',
            theme: 'Theme',
            themeDesc: 'Light or dark mode',
            notifications: 'Notifications',
            tempAlert: 'High temperature alert',
            tempAlertDesc: 'Notify when temperature exceeds threshold',
            humidityAlert: 'High humidity alert',
            humidityAlertDesc: 'Notify when humidity exceeds threshold',
            presenceAlert: 'Presence detection alert',
            presenceAlertDesc: 'Notify when someone enters room',
            roomManagement: 'Room Management',
            addRoom: 'Add Room',
            userManagement: 'User Management',
            addUser: 'Add',
            systemSettings: 'System Settings',
            tempThreshold: 'Temperature threshold',
            tempThresholdDesc: 'Alert when temperature exceeds threshold',
            humidityThreshold: 'Humidity threshold',
            humidityThresholdDesc: 'Alert when humidity exceeds threshold',
            autoOff: 'Auto turn off devices',
            autoOffDesc: 'Turn off all when no presence',
            saveSettings: 'Save Settings',
            about: 'About',
            settingsSaved: 'Settings saved',
            userAdded: 'User added',
            userDeleted: 'User deleted',
            admin: 'Administrator',
            user: 'User',
            selectRoom: 'Select room...',
            noRooms: 'No rooms found.',
            noUsers: 'No users found.',
            confirmDeleteRoom: 'Are you sure you want to delete room',
            confirmDeleteUser: 'Are you sure you want to delete this user?',
            roomAdded: 'Room added',
            roomDeleted: 'Room deleted',
            enterRoomId: 'Please enter room ID',
            enterEmailRoom: 'Please enter email and select room',
            passwordResetSent: 'Password reset email sent!'
        }
    };

    function applyLanguage(lang) {
        currentLanguage = lang;
        localStorage.setItem('language', lang);

        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang] && translations[lang][key]) {
                el.textContent = translations[lang][key];
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (translations[lang] && translations[lang][key]) {
                el.placeholder = translations[lang][key];
            }
        });

        const languageSelect = document.getElementById('language-select');
        if (languageSelect) languageSelect.value = lang;

        // Update page title based on current view
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            const currentTitle = pageTitle.textContent.toLowerCase();
            if (currentTitle.includes('dashboard') || currentTitle.includes('bảng') || currentTitle.includes('điều khiển'))
                pageTitle.textContent = translations[lang].navDashboard;
            else if (currentTitle.includes('phòng') || currentTitle.includes('room'))
                pageTitle.textContent = translations[lang].navRooms;
            else if (currentTitle.includes('thống') || currentTitle.includes('statistic'))
                pageTitle.textContent = translations[lang].navStatistics;
            else if (currentTitle.includes('cài') || currentTitle.includes('setting'))
                pageTitle.textContent = translations[lang].navSettings;
        }
    }

    // --- Theme ---
    let currentTheme = localStorage.getItem('theme') || 'light';

    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem('theme', theme);

        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // Update buttons
        const lightBtn = document.getElementById('theme-light');
        const darkBtn = document.getElementById('theme-dark');
        if (lightBtn && darkBtn) {
            lightBtn.classList.toggle('active', theme === 'light');
            darkBtn.classList.toggle('active', theme === 'dark');
        }
    }

    // --- User Management ---
    function loadUserList() {
        const container = document.getElementById('user-list-manage');
        const roomSelect = document.getElementById('new-user-room');
        if (!container) return;

        // Load rooms for select dropdown
        db.ref('Rooms').once('value').then(snapshot => {
            const rooms = snapshot.val() || {};
            if (roomSelect) {
                roomSelect.innerHTML = '<option value="">Chọn phòng...</option>';
                Object.keys(rooms).forEach(roomId => {
                    roomSelect.innerHTML += `<option value="${roomId}">${roomId}</option>`;
                });
            }
        });

        // Load users
        db.ref('users').once('value').then(snapshot => {
            const users = snapshot.val() || {};
            container.innerHTML = '';

            const userEntries = Object.entries(users);
            if (userEntries.length === 0) {
                container.innerHTML = '<p style="color: #7F8C8D;">Chưa có người dùng nào.</p>';
                return;
            }

            userEntries.forEach(([uid, userData]) => {
                if (userData.role === 'admin') return; // Skip admins

                const item = document.createElement('div');
                item.className = 'user-manage-item';
                item.innerHTML = `
                    <div class="user-info">
                        <span class="user-email">${userData.email || uid}</span>
                        <span class="user-room">Phòng: ${userData.roomId || 'N/A'}</span>
                    </div>
                    <button class="btn-delete-user" data-uid="${uid}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
                container.appendChild(item);
            });

            // Add delete listeners
            container.querySelectorAll('.btn-delete-user').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const uid = e.currentTarget.dataset.uid;
                    if (confirm('Bạn có chắc muốn xóa người dùng này?')) {
                        deleteUser(uid);
                    }
                });
            });
        });
    }

    function addUser(email, roomId) {
        if (!email || !roomId) {
            showToast('Vui lòng nhập email và chọn phòng', 'error');
            return;
        }

        // Note: In a real app, you'd create user via Firebase Admin SDK
        // For now, we'll just store user data
        const userRef = db.ref('pendingUsers').push();
        userRef.set({
            email: email,
            roomId: roomId,
            createdAt: Date.now()
        }).then(() => {
            showToast(translations[currentLanguage].userAdded || 'Đã thêm người dùng', 'success');
            document.getElementById('new-user-email').value = '';
            document.getElementById('new-user-room').value = '';
        }).catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    function deleteUser(uid) {
        db.ref(`users/${uid}`).remove()
            .then(() => {
                showToast(translations[currentLanguage].userDeleted || 'Đã xóa người dùng', 'success');
                loadUserList();
            })
            .catch(err => showToast('Lỗi: ' + err.message, 'error'));
    }

    // Apply saved preferences on load
    applyTheme(currentTheme);
    applyLanguage(currentLanguage);

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
    console.log('Setting up navigation listeners...');
    console.log('navDashboard:', navDashboard);
    console.log('navRooms:', navRooms);
    console.log('navStatistics:', navStatistics);

    if (navDashboard) navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Dashboard clicked');
        showView('dashboard');
        loadAdminData();
    });

    if (navRooms) navRooms.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Rooms clicked');
        showView('rooms');
    });

    if (navStatistics) navStatistics.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Statistics clicked');
        showView('statistics');
    });

    if (navSettings) navSettings.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Settings clicked');
        showView('settings');
    });

    if (btnBackRooms) btnBackRooms.addEventListener('click', () => {
        showView('rooms');
    });

    // Settings buttons
    const btnAddRoom = document.getElementById('btn-add-room');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnChangePassword = document.getElementById('btn-change-password');

    if (btnAddRoom) btnAddRoom.addEventListener('click', () => {
        const newRoomId = document.getElementById('new-room-id');
        if (newRoomId) addRoom(newRoomId.value);
    });

    if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveSettings);

    if (btnChangePassword) btnChangePassword.addEventListener('click', () => {
        const user = auth.currentUser;
        if (user && user.email) {
            auth.sendPasswordResetEmail(user.email)
                .then(() => showToast('Email đổi mật khẩu đã được gửi!', 'success'))
                .catch(err => showToast('Lỗi: ' + err.message, 'error'));
        }
    });

    // Language selector
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.value = currentLanguage;
        languageSelect.addEventListener('change', (e) => {
            applyLanguage(e.target.value);
        });
    }

    // Theme toggle
    const themeLight = document.getElementById('theme-light');
    const themeDark = document.getElementById('theme-dark');
    if (themeLight) themeLight.addEventListener('click', () => applyTheme('light'));
    if (themeDark) themeDark.addEventListener('click', () => applyTheme('dark'));

    // Add user button
    const btnAddUser = document.getElementById('btn-add-user');
    if (btnAddUser) btnAddUser.addEventListener('click', () => {
        const email = document.getElementById('new-user-email');
        const room = document.getElementById('new-user-room');
        if (email && room) addUser(email.value, room.value);
    });

    if (masterOff) masterOff.addEventListener('click', turnAllOff);
    if (masterOn) masterOn.addEventListener('click', turnAllOn);

    if (autoModeToggle) {
        autoModeToggle.addEventListener('change', async (e) => {
            if (!currentRoomId) return;
            const isAuto = e.target.checked;

            // When switching from AUTO to MANUAL, copy actual states to commands
            // so devices stay ON if they were ON
            if (!isAuto) {
                try {
                    const updates = {};
                    for (let i = 1; i <= DEVICE_COUNT; i++) {
                        // Read actual states
                        const actualDenSnap = await db.ref(`Rooms/${currentRoomId}/ActualDen${i}`).once('value');
                        const actualQuatSnap = await db.ref(`Rooms/${currentRoomId}/ActualQuat${i}`).once('value');

                        const denState = actualDenSnap.val() == 1 ? 1 : 0;
                        const quatState = actualQuatSnap.val() == 1 ? 1 : 0;

                        // Copy to command values
                        updates[`Rooms/${currentRoomId}/Den${i}`] = denState;
                        updates[`Rooms/${currentRoomId}/Quat${i}`] = quatState;
                    }

                    // Apply all updates + set AutoMode to false
                    updates[`Rooms/${currentRoomId}/AutoMode`] = false;
                    await db.ref().update(updates);

                    console.log('[AUTO->MANUAL] Copied actual states to commands');
                } catch (err) {
                    showToast(`Lỗi: ` + err.message, 'error');
                }
            } else {
                // Just set AUTO mode
                db.ref(`Rooms/${currentRoomId}/AutoMode`).set(isAuto)
                    .catch(err => showToast(`Lỗi: ` + err.message, 'error'));
            }
        });
    }

    for (let i = 1; i <= DEVICE_COUNT; i++) {
        const lToggle = document.getElementById(`light-toggle-${i}`);
        if (lToggle) lToggle.addEventListener('change', (e) => toggleLight(i, e.target.checked));

        const fToggle = document.getElementById(`fan-toggle-${i}`);
        if (fToggle) fToggle.addEventListener('change', (e) => toggleFan(i, e.target.checked));
    }
});
