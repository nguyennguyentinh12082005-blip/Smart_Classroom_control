document.addEventListener('DOMContentLoaded', () => {
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

    // State Management
    let state = {
        light: false,
        fan: false,
        fanSpeed: 50
    };

    // --- Initialization ---
    function init() {
        // Simulate connection delay
        setTimeout(() => {
            connectionStatus.style.opacity = '1';
            connectionStatus.style.transform = 'translateY(0)';
            showToast('Đã kết nối với hệ thống', 'success');

            // Start updating sensors
            updateSensors();
            setInterval(updateSensors, 3000);
        }, 1500);
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

    // --- Actions ---
    function toggleLight(isOn) {
        state.light = isOn;
        lightToggle.checked = isOn;
        updateLightUI();
        sendCommand('light', 'state', isOn ? 'on' : 'off');
    }

    function toggleFan(isOn) {
        state.fan = isOn;
        fanToggle.checked = isOn;
        updateFanUI();
        sendCommand('fan', 'state', isOn ? 'on' : 'off');
    }

    function setFanSpeed(value) {
        state.fanSpeed = value;
        updateFanUI();
        // Debounce sending command for slider
        // sendCommand('fan', 'speed', value); 
    }

    function turnAllOff() {
        toggleLight(false);
        toggleFan(false);
        showToast('Đã tắt tất cả thiết bị');
    }

    // --- Sensor Logic ---
    function updateSensors() {
        // Simulate random data
        const temp = (25 + Math.random() * 5).toFixed(1);
        const humid = (60 + Math.random() * 20).toFixed(0);
        const light = (300 + Math.random() * 50).toFixed(0);

        tempValue.textContent = temp;
        humidValue.textContent = humid;
        lightValValue.textContent = light;

        // Update color based on values (optional)
    }

    // --- Mock API ---
    function sendCommand(device, param, value) {
        console.log(`Sending: ${device} ${param} = ${value}`);
        // Simulate network request
        // fetch(`/api/${device}?${param}=${value}`);
    }

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';

        let icon = '<i class="fa-solid fa-info-circle"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-check-circle" style="color: #00b894;"></i>';

        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after 3s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 400);
        }, 3000);
    }

    // --- Event Listeners ---
    lightToggle.addEventListener('change', (e) => {
        toggleLight(e.target.checked);
        if (e.target.checked) showToast('Đã bật đèn lớp học', 'success');
    });

    fanToggle.addEventListener('change', (e) => {
        toggleFan(e.target.checked);
        if (e.target.checked) showToast('Đã bật quạt trần', 'success');
    });

    fanSpeed.addEventListener('input', (e) => {
        setFanSpeed(e.target.value);
    });

    fanSpeed.addEventListener('change', (e) => {
        sendCommand('fan', 'speed', e.target.value);
    });

    masterToggle.addEventListener('click', turnAllOff);

    // Add dynamic styles for animation
    // Run Init
    init();
});
