<template>
  <div class="sidebar" :class="{ 'is-collapsed': isCollapsed }">
    <div class="header">
      <div class="icon-toggle" @click="toggleSidebar" title="Toggle Menu">☰</div>
      
      <div v-show="!isCollapsed" class="brand-wrapper">
        <img src="/IconApp.png" alt="Logo" class="brand-logo" />
        <span class="title-text">GIS Dashboard</span>
      </div>
    </div>
    
    <div class="menu">
      <div 
        class="item" 
        :class="{ active: route.path === '/map' }" 
        @click="router.push('/map')"
        :title="isCollapsed ? 'Live Map' : ''"
      >
        <span class="item-icon">🗺️</span>
        <span v-show="!isCollapsed" class="item-text">Live Map</span>
      </div>

      <div
        class="item" 
        :class="{ active: route.path === '/analytics' }" 
        @click="router.push('/analytics')"
        :title="isCollapsed ? 'Analytics' : ''"
      >
        <span class="item-icon">📊</span>
        <span v-show="!isCollapsed" class="item-text">Analytics</span>
      </div>
      
      <div 
        v-if="userRole === 'admin'" 
        class="item" 
        :class="{ active: route.path === '/users' }"
        @click="router.push('/users')"
        :title="isCollapsed ? 'User Management' : ''"
      >
        <span class="item-icon">👤</span>
        <span v-show="!isCollapsed" class="item-text">User Management</span>
      </div>
      
      <div 
        class="item" 
        :class="{ active: route.path === '/profile' }"
        @click="router.push('/profile')" 
        :title="isCollapsed ? 'My Profile' : ''"
      >
        <span class="item-icon">⚙️</span>
        <span v-show="!isCollapsed" class="item-text">My Profile</span>
      </div>
    </div>

    <div class="footer">
      <div class="item logout" @click="logout" :title="isCollapsed ? 'Sign Out' : ''">
        <span class="item-icon">🚪</span>
        <span v-show="!isCollapsed" class="item-text">Sign Out</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const isCollapsed = ref(false) 
const userRole = ref('user') 

onMounted(() => {
  userRole.value = localStorage.getItem('user_role') || 'user'
})

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user_role')
  router.push('/')
}
</script>

<style scoped>
.sidebar {
  width: 260px; /* Nới rộng một chút để chứa logo và text cho thoải mái */
  background: #ffffff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
  box-shadow: 2px 0 10px rgba(0,0,0,0.02);
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.sidebar.is-collapsed {
  width: 70px;
}

.header {
  padding: 0 20px;
  background: #011d42;
  color: white;
  display: flex;
  align-items: center;
  gap: 15px;
  white-space: nowrap;
  height: 70px; /* Cố định chiều cao để không bị giật khi thu phóng */
  box-sizing: border-box;
}

.icon-toggle {
  cursor: pointer;
  font-size: 22px;
  user-select: none;
  min-width: 25px;
  text-align: center;
  transition: color 0.2s;
}

.icon-toggle:hover {
  color: #4caf50;
}

/* Style cho Logo và Tên App */
.brand-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.title-text {
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 0.5px;
}

.menu {
  flex: 1;
  padding-top: 15px;
}

.item {
  padding: 15px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 15px;
  white-space: nowrap;
  color: #444;
  font-weight: 500;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.item-icon {
  font-size: 18px;
  min-width: 25px;
  text-align: center;
}

.item:hover {
  background: #f8f9fa;
  color: #011d42;
}

.active {
  background: #e8f0fe;
  color: #011d42;
  font-weight: 700;
  border-left: 4px solid #4caf50; /* Điểm nhấn xanh lá cây viền trái */
}

.footer {
  margin-bottom: 10px;
}

.logout {
  color: #d32f2f;
  border-top: 1px solid #eee;
  margin-top: 10px;
}

.logout:hover {
  background: #ffebee;
  color: #b71c1c;
}
</style>