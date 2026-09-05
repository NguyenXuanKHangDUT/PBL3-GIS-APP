<template>
  <div
    class="stream-popover-backdrop"
    @click="emit('close')"
  ></div>

  <div
    class="stream-popover"
    :style="{
      left: `${left}px`,
      top: `${top}px`
    }"
    @click.stop
  >
    <div class="stream-popover-header">
      <div>
        <h4>Add Camera</h4>
        <p>
          Enter the camera stream link for the selected road segment.
        </p>
      </div>

      <button
        class="stream-close-btn"
        @click="emit('close')"
      >
        ✖
      </button>
    </div>

    <input
      ref="inputRef"
      v-model="streamValue"
      class="stream-input"
      type="text"
      placeholder="http://.../stream.m3u8 or .mp4"
      @keyup.enter="submit"
      @keyup.esc="emit('close')"
    />

    <div class="stream-popover-actions">
      <button
        class="stream-btn outline"
        @click="emit('close')"
      >
        Cancel
      </button>

      <button
        class="stream-btn fill"
        @click="submit"
      >
        Continue Selecting ROI
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

defineProps({
  left: {
    type: Number,
    required: true
  },

  top: {
    type: Number,
    required: true
  }
})

const emit = defineEmits([
  'close',
  'submit'
])

const streamValue = ref('')
const inputRef = ref(null)

onMounted(() => {
  inputRef.value?.focus()
})

const submit = () => {
  const value = streamValue.value.trim()

  if (!value) {
    alert('Please enter the camera link.')
    return
  }

  emit('submit', value)
}
</script>

<style scoped>
.stream-popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2499;
  background: transparent;
}

.stream-popover {
  position: fixed;
  width: 360px;
  z-index: 2500;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
  border: 1px solid #dfe3ea;
  overflow: hidden;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
}

.stream-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px 10px 16px;
  background: #011d42;
  color: white;
}

.stream-popover-header h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
}

.stream-popover-header p {
  margin: 0;
  font-size: 12px;
  opacity: 0.85;
  line-height: 1.35;
}

.stream-close-btn {
  border: none;
  background: transparent;
  color: white;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}

.stream-input {
  width: calc(100% - 28px);
  margin: 14px;
  padding: 11px 12px;
  border: 1px solid #cfd6e4;
  border-radius: 7px;
  outline: none;
  font-size: 13px;
  box-sizing: border-box;
}

.stream-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12);
}

.stream-popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 14px 14px 14px;
}

.stream-btn {
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  border: 1px solid #011d42;
}

.stream-btn.outline {
  background: white;
  color: #011d42;
}

.stream-btn.fill {
  background: #011d42;
  color: white;
}
</style>