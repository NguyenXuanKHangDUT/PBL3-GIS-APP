<template>
  <div class="login-container">
    
    <div class="login-banner">
      <div class="banner-content">
        <h1 class="brand-title">GIS APP</h1>
        <h3 class="brand-subtitle">Real-time Traffic Intelligence Platform</h3>
        <p class="brand-description">
          Empowering smart cities with real-time traffic monitoring, YOLO-based vehicle detection, and dynamic spatial routing. Manage your urban grid with unprecedented accuracy and AI-driven insights.
        </p>
        
        <div class="feature-list">
          <div class="feature-item"><span>✦</span> Live Density Heatmaps</div>
          <div class="feature-item"><span>✦</span> Spatial GIS Queries</div>
          <div class="feature-item"><span>✦</span> Dynamic Smart Routing</div>
        </div>
      </div>
      
      <div class="overlay-pattern"></div>
    </div>

    <div class="login-form-wrapper">
      <div class="login-card">
        <div class="card-header">
          <h2>Welcome Back</h2>
          <p>Please enter your admin credentials to continue.</p>
        </div>
        
        <div class="form-group">
          <label>Username / ID</label>
          <input 
            v-model="username" 
            type="text" 
            placeholder="Enter your username" 
          />
        </div>
        
        <div class="form-group">
          <label>Password</label>
          <input 
            v-model="password" 
            type="password" 
            placeholder="Enter your password" 
            @keyup.enter="handleLogin" 
          />
        </div>
        
        <button class="login-btn" @click="handleLogin">Sign In to Dashboard</button>
        
        <div class="card-footer">
          <p>Secure Access Only • Internal System</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')

const handleLogin = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    });

    const data = await response.json();

    if (data.success) {
      /* LƯU TOKEN VÀ ROLE VÀO TRÌNH DUYỆT */
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_role', data.data.role);
      localStorage.setItem('username', data.data.username);
      
      router.push('/map'); 
    } else {
      alert(data.message); 
    }
  } catch (error) {
    console.error("Lỗi chi tiết:", error);
    alert("Lỗi kết nối đến máy chủ!");
  }
}
</script>

<style scoped>
/* Reset & Layout chung */
.login-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #f4f7f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
}

/* --- NỬA TRÁI (BANNER) --- */
.login-banner {
  flex: 5;
  background: linear-gradient(135deg, #011d42 0%, #023b87 100%);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 10%;
  position: relative;
}

.banner-content {
  position: relative;
  z-index: 2;
  max-width: 600px;
}

.brand-title {
  font-size: 3.5rem;
  font-weight: 800;
  margin: 0 0 10px 0;
  letter-spacing: 1px;
}

.brand-subtitle {
  font-size: 1.4rem;
  font-weight: 400;
  color: #4caf50; /* Xanh lá tạo điểm nhấn */
  margin: 0 0 30px 0;
}

.brand-description {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #c5d6eb;
  margin-bottom: 40px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.feature-item {
  font-size: 1.1rem;
  font-weight: 500;
  color: #e0e0e0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.feature-item span {
  color: #4caf50;
}

/* Họa tiết mờ trang trí nền trái */
.overlay-pattern {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 30px 30px;
  opacity: 0.3;
  z-index: 1;
}

/* --- NỬA PHẢI (FORM) --- */
.login-form-wrapper {
  flex: 4;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #ffffff;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
}

.card-header {
  margin-bottom: 40px;
}

.card-header h2 {
  font-size: 2rem;
  color: #011d42;
  margin: 0 0 10px 0;
}

.card-header p {
  color: #666;
  margin: 0;
  font-size: 1rem;
}

.form-group {
  margin-bottom: 25px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
}

.form-group input {
  padding: 14px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: #f9f9f9;
}

.form-group input:focus {
  outline: none;
  border-color: #011d42;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(1, 29, 66, 0.1);
}

.login-btn {
  width: 100%;
  padding: 15px;
  background: #011d42;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-top: 10px;
}

.login-btn:hover {
  background: #022c64;
}

.card-footer {
  margin-top: 30px;
  text-align: center;
  font-size: 0.85rem;
  color: #aaa;
}

/* Responsive cơ bản cho màn hình nhỏ */
@media (max-width: 900px) {
  .login-container {
    flex-direction: column;
  }
  .login-banner {
    flex: none;
    padding: 40px 20px;
    align-items: center;
    text-align: center;
  }
  .feature-list {
    align-items: center;
  }
  .login-form-wrapper {
    flex: 1;
    padding: 20px;
  }
}
</style>