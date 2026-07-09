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
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
}

.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main-content {
  flex: 1;
  position: relative;
  overflow-y: auto;
  background: #f4f7f6;
}
</style>