// Initialize Firebase (Config is loaded from firebase-config.js)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// DOM Elements
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

// Check if already logged in
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is already logged in, redirect to dashboard
        window.location.href = 'index.html';
    }
});

// Handle Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPassword.value;
    loginError.textContent = ''; // Clear prev error

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in successfully
            // Redirect is handled by onAuthStateChanged or manually here
            window.location.href = 'index.html';
        })
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

// Toast Notification Helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    // Style adjustments if needed, assuming style.css is loaded
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 400);
    }, 3000);
}
