<template>
  <div class="profile-container">
    <div class="profile-card">
      <div class="header-info">
        <div class="avatar">👤</div>
        <h2>Welcome, {{ username }}!</h2>
        <span class="role-badge">{{ role === 'admin' ? 'Administrator' : 'Standard User' }}</span>
      </div>

      <div class="edit-section">
        <h3>Change Password</h3>
        <div class="form-group">
          <input type="password" v-model="passwords.oldPassword" placeholder="Current Password" />
          <input type="password" v-model="passwords.newPassword" placeholder="New Password" />
          <input type="password" v-model="passwords.confirmPassword" placeholder="Confirm New Password" />
          <button class="btn-save" @click="handleUpdatePassword">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const username = ref('')
const role = ref('')
const token = localStorage.getItem('token')

const passwords = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

onMounted(() => {
  username.value = localStorage.getItem('username') || 'Account'
  role.value = localStorage.getItem('user_role') || 'user'
})

const handleUpdatePassword = async () => {
  if (!passwords.value.oldPassword || !passwords.value.newPassword) {
    return alert("Please fill in all required fields!");
  }
  if (passwords.value.newPassword !== passwords.value.confirmPassword) {
    return alert("New passwords do not match!");
  }

  try {
    const response = await fetch('http://localhost:5000/api/users/profile/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        oldPassword: passwords.value.oldPassword,
        newPassword: passwords.value.newPassword
      })
    })

    const data = await response.json();
    if (data.success) {
      alert("Password updated successfully!");
      passwords.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
    } else {
      alert(data.message);
    }
  } catch (error) {
    alert("Connection Error. Failed to update password.");
  }
}
</script>

<style scoped>
.profile-container {
  padding: 50px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  background: #f4f7f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.profile-card {
  background: white;
  width: 100%;
  max-width: 450px;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.05);
  padding: 40px;
}

.header-info {
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 30px;
  margin-bottom: 25px;
}

.avatar {
  font-size: 65px;
  margin-bottom: 15px;
}

.header-info h2 {
  margin: 0 0 12px 0;
  color: #011d42;
  font-size: 1.5rem;
  letter-spacing: 0.5px;
}

.role-badge {
  background: #011d42;
  color: white;
  padding: 6px 18px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.edit-section h3 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

input {
  padding: 14px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  background: #f9f9f9;
}

input:focus {
  outline: none;
  border-color: #011d42;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(1, 29, 66, 0.1);
}

.btn-save {
  background: #011d42;
  color: white;
  border: none;
  padding: 14px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 10px;
  transition: background 0.3s ease;
}

.btn-save:hover {
  background: #022c64;
}
</style>