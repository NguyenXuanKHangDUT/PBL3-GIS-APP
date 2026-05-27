<template>
  <div class="layer-tools">
    <div class="control-card">
      <span class="control-title">Layer</span>
      <div class="control-options">
        <label class="control-item">
          <input 
            type="radio" 
            name="map-layer" 
            value="heatmap" 
            v-model="selectedLayer" 
            @change="$emit('change-layer', selectedLayer)"
          >
          <span>Heatmap</span>
        </label>
        <label class="control-item">
          <input 
            type="radio" 
            name="map-layer" 
            value="camera" 
            v-model="selectedLayer" 
            @change="$emit('change-layer', selectedLayer)"
          >
          <span>Camera</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const selectedLayer = ref('heatmap')
defineEmits(['change-layer'])
</script>

<style scoped>
.layer-tools {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.control-card {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  min-width: 130px;
  border: 1px solid #ddd;
}

.control-title {
  display: block;
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 10px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.control-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #444;
}

.control-item input {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.control-item:hover {
  color: #011d42;
}
</style>