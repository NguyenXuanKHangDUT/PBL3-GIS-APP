<template>
  <div class="app-layout">
    <Sidebar v-if="route.path !== '/'" />
    
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import Sidebar from './components/Sidebar.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style>
/* Reset margin/padding cơ bản */
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
}

.app-layout {
  display: flex; /* Đặt Sidebar và Nội dung nằm dàn hàng ngang */
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main-content {
  flex: 1; /* Để nội dung chiếm hết phần còn lại bên phải */
  position: relative;
  overflow-y: auto; /* Cho phép cuộn nội dung nếu trang quá dài */
  background: #f4f7f6;
}
</style>