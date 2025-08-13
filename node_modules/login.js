// login.js - Lógica de cadastro e login para uso com backend

// Configuração da API
const API_URL = `${window.location.protocol}//${window.location.host}/api`;

// Variáveis globais
let currentUser = null;

// Função para mostrar alertas
function showAlert(containerId, message, type = 'info') {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        if (container.innerHTML.includes(message)) {
            container.innerHTML = '';
        }
    }, 5000);
}

// Função para mostrar loading
function showLoading(show = true) {
    const loading = document.getElementById('loadingScreen');
    const forms = document.querySelectorAll('.form-container');
    if (show) {
        forms.forEach(form => form.classList.add('hidden'));
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

// Alternar entre login e cadastro
function showLogin() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    loginForm.classList.add('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.remove('active');
    registerForm.classList.add('hidden');
    document.getElementById('userInfo').classList.remove('show');
    clearAlerts();
}

function showRegister() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    loginForm.classList.remove('active');
    loginForm.classList.add('hidden');
    registerForm.classList.add('active');
    registerForm.classList.remove('hidden');
    document.getElementById('userInfo').classList.remove('show');
    clearAlerts();
}

function clearAlerts() {
    document.getElementById('loginAlert').innerHTML = '';
    document.getElementById('registerAlert').innerHTML = '';
}

// Mostrar/ocultar campo de código admin
function toggleAdminCode() {
    const adminCodeGroup = document.getElementById('adminCodeGroup');
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle.checked) {
        adminCodeGroup.classList.add('show');
    } else {
        adminCodeGroup.classList.remove('show');
        document.getElementById('adminCode').value = '';
    }
}

// Função para fazer requisições à API
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || result.message || `HTTP error! status: ${response.status}`);
        }
        return result;
    } catch (error) {
        console.error('Erro na API:', error);
        throw error;
    }
}

// Hash simples para senhas (em produção, usar bcrypt no backend)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validar formulário de cadastro
function validateRegisterForm(formData) {
    const errors = [];
    if (!formData.name.trim()) {
        errors.push('Nome é obrigatório');
    }
    if (!formData.email.trim()) {
        errors.push('Email é obrigatório');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.push('Email inválido');
    }
    if (!formData.password) {
        errors.push('Senha é obrigatória');
    } else if (formData.password.length < 6) {
        errors.push('Senha deve ter pelo menos 6 caracteres');
    }
    if (formData.password !== formData.confirmPassword) {
        errors.push('Senhas não coincidem');
    }
    return errors;
}

// Handler do formulário de login
if (document.getElementById('loginFormElement')) {
    document.getElementById('loginFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password')
        };
        try {
            showLoading(true);
            const hashedPassword = await hashPassword(loginData.password);
            const response = await apiRequest('/login', 'POST', {
                email: loginData.email,
                password: hashedPassword
            });
            showLoading(false);
            if (response.success) {
                currentUser = response.user;
                showUserInfo();
                showAlert('loginAlert', 'Login realizado com sucesso!', 'success');
            } else {
                showAlert('loginAlert', response.message || 'Erro no login', 'error');
                showLogin();
            }
        } catch (error) {
            showLoading(false);
            showLogin();
            showAlert('loginAlert', 'Erro ao fazer login: ' + error.message, 'error');
        }
    });
}

// Handler do formulário de cadastro
if (document.getElementById('registerFormElement')) {
    document.getElementById('registerFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const registerData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword'),
            adminCode: formData.get('adminCode') || ''
        };
        const errors = validateRegisterForm(registerData);
        if (errors.length > 0) {
            showAlert('registerAlert', errors.join('<br>'), 'error');
            return;
        }
        try {
            showLoading(true);
            const hashedPassword = await hashPassword(registerData.password);
            let userType = 'user';
            
            // Verifica o código de admin apenas se foi fornecido
            if (registerData.adminCode) {
                if (registerData.adminCode === 'HBSDQK0101') {
                    userType = 'admin';
                } else {
                    showAlert('registerAlert', 'Código de administrador inválido!', 'error');
                    showLoading(false);
                    return;
                }
            }
            
            const response = await apiRequest('/register', 'POST', {
                name: registerData.name,
                email: registerData.email,
                password: hashedPassword,
                userType: userType
            });
            showLoading(false);
            if (response.success) {
                currentUser = response.user;
                showUserInfo();
                showAlert('registerAlert', 'Cadastro realizado com sucesso!', 'success');
            } else {
                showAlert('registerAlert', response.message || 'Erro no cadastro', 'error');
                showRegister();
            }
        } catch (error) {
            showLoading(false);
            showRegister();
            showAlert('registerAlert', 'Erro ao fazer cadastro: ' + error.message, 'error');
        }
    });
}

// Mostrar informações do usuário
function showUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const userDetails = document.getElementById('userDetails');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    userDetails.innerHTML = `
        <h3>${currentUser.name}</h3>
        <p><strong>Email:</strong> ${currentUser.email}</p>
        <div class="user-badge ${currentUser.userType}">
            ${currentUser.userType === 'admin' ? ' Administrador' : 'Usuário'}
        </div>
    `;
    userInfo.classList.add('show');

    // Controle do botão "Voltar ao Estoque"
    const btnVoltar = document.querySelector('.btn-voltar-estoque');
    if (btnVoltar) {
        if (currentUser.userType === 'admin') {
            btnVoltar.classList.remove('hidden');
        } else {
            btnVoltar.classList.add('hidden');
        }
    }
}

// Logout
function logout() {
    currentUser = null;
    showLogin();
    document.getElementById('loginFormElement').reset();
    document.getElementById('registerFormElement').reset();
    showAlert('loginAlert', 'Logout realizado com sucesso!', 'info');
}

// Redirecionar para o sistema principal
function redirectToSystem() {
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    window.location.href = '/index.html';
}

// Verificar se já está logado
function checkExistingLogin() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showUserInfo();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();
});

document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();

    // Esconde o botão "Voltar ao Estoque" para usuários comuns
    const btnVoltar = document.querySelector('.btn-voltar-estoque');
    if (btnVoltar && currentUser && currentUser.userType !== 'admin') {
                    btnVoltar.classList.add('hidden');
    }
});