document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const auth = firebase.auth();

    // DOM Elements
    const loginCard = document.getElementById('login-card');
    const signupCard = document.getElementById('signup-card');
    const loginForm = document.getElementById('login-form');
    const loginRoomInput = document.getElementById('login-room');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');

    const signupForm = document.getElementById('signup-form');
    const signupRoomInput = document.getElementById('signup-room');
    const signupPassword = document.getElementById('signup-password');
    const signupCodeInput = document.getElementById('signup-code');
    const signupError = document.getElementById('signup-error');

    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');

    const ADMIN_CODE = "123456";
    const SUPER_ADMIN_EMAIL = "nguyennguyentinh12082005@gmail.com";

    // --- Auth State Listener ---
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("User already logged in, redirecting to dashboard...");
                    window.location.href = 'dashboard.html';
                }
            });
        })
        .catch(err => console.error("Persistence Error:", err));


    // --- UI Toggles ---
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

    // --- Helpers ---
    function formatEmail(input) {
        if (input.includes('@')) return input;
        return input.trim() + "@smartclass.local";
    }

    // --- Handlers ---
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = loginRoomInput.value.trim();
            const email = formatEmail(input);
            auth.signInWithEmailAndPassword(email, loginPassword.value)
                .then(() => {
                    // Redirect handled by onAuthStateChanged
                })
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

                    const roomId = input.toUpperCase();
                    if (roomId !== 'ADMIN' && email !== SUPER_ADMIN_EMAIL && !email.includes('gmail.com')) {
                        // Initialize with default empty data (0) for visualization
                        const initData = {
                            created: true,
                            NhietDo: 0,
                            DoAm: 0,
                            AnhSang: 0,
                            PhatHienNguoi: 0,
                            Den1: 0, Den2: 0, Den3: 0,
                            Quat1: 0, Quat2: 0, Quat3: 0,
                            TocDoQuat1: 0, TocDoQuat2: 0, TocDoQuat3: 0,
                            CheDoTuDong: true // Default Auto Mode ON
                        };
                        db.ref('Rooms/' + roomId).update(initData);
                    }
                    alert("Tạo tài khoản thành công! Đang chuyển hướng...");
                    // Redirect handled by onAuthStateChanged
                })
                .catch(err => signupError.textContent = "Lỗi: " + err.message);
        });
    }
});
