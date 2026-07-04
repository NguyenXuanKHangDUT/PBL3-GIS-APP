<template>
  <div class="management-container">
    <h2>👥 User Management</h2>

    <div class="add-user-card">
      <h3>Create New Account</h3>
      <div class="form-group">
        <input v-model="newUser.username" type="text" placeholder="Username (Employee ID)" />
        <input v-model="newUser.password" type="password" placeholder="Password" />
        <select v-model="newUser.role">
          <option value="user">User (View Only)</option>
          <option value="admin">Administrator</option>
        </select>
        <button class="btn-add" @click="handleAddUser">Add User</button>
      </div>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Access Role</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>#{{ user.id }}</td>
            <td><strong>{{ user.username }}</strong></td>
            <td>
              <select v-model="user.role" @change="updateRole(user)" :disabled="user.username === 'admin'">
                <option value="admin">Administrator</option>
                <option value="user">User</option>
              </select>
            </td>
            <td>{{ new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}</td>
            <td>
              <button class="btn-delete" @click="confirmDelete(user)" :disabled="user.username === 'admin'">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const users = ref([])
const token = localStorage.getItem('token')

const newUser = ref({ username: '', password: '', role: 'user' })

const fetchUsers = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await response.json()
    if (data.success) users.value = data.data
  } catch (err) {
    console.error("Fetch Error:", err)
  }
}

const handleAddUser = async () => {
  if (!newUser.value.username || !newUser.value.password) {
    alert("Please provide both Username and Password!")
    return
  }
  try {
    const response = await fetch('http://localhost:5000/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(newUser.value)
    })
    const data = await response.json()
    if (data.success) {
      alert("Account created successfully!")
      newUser.value = { username: '', password: '', role: 'user' }
      fetchUsers() 
    } else {
      alert(data.message)
    }
  } catch (err) {
    alert("Error creating user account!")
  }
}

const updateRole = async (user) => {
  try {
    const response = await fetch(`http://localhost:5000/api/users/${user.id}/role`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ role: user.role })
    })
    const data = await response.json()
    if (data.success) alert("User role updated successfully!")
  } catch (err) {
    alert("Failed to update role!")
  }
}

const confirmDelete = async (user) => {
  if (!confirm(`Are you sure you want to delete the account '${user.username}'? This action cannot be undone.`)) return
  try {
    const response = await fetch(`http://localhost:5000/api/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await response.json()
    if (data.success) {
      users.value = users.value.filter(u => u.id !== user.id)
      alert("Account deleted successfully!")
    }
  } catch (err) {
    alert("Error deleting account!")
  }
}

onMounted(fetchUsers)
</script>

<style scoped>
.management-container { padding: 30px; background: #f4f7f9; min-height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;}
.management-container h2 { color: #011d42; margin-top: 0; margin-bottom: 20px;}

.add-user-card {
  background: white;
  padding: 25px;
  border-radius: 10px;
  margin-bottom: 30px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}
.add-user-card h3 { margin-top: 0; color: #011d42; margin-bottom: 15px; font-size: 1.1rem;}
.form-group { display: flex; gap: 15px; flex-wrap: wrap; align-items: center;}
.form-group input, .form-group select {
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  flex: 1;
  min-width: 200px;
  font-size: 0.95rem;
  transition: 0.2s;
}
.form-group input:focus, .form-group select:focus {
  outline: none;
  border-color: #011d42;
  box-shadow: 0 0 0 2px rgba(1, 29, 66, 0.1);
}

.btn-add {
  background: #011d42;
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.95rem;
  transition: 0.2s;
}
.btn-add:hover { background: #022c64; }

.table-card { background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 16px 20px; text-align: left; border-bottom: 1px solid #eee; font-size: 0.95rem;}
th { background: #011d42; color: white; font-weight: 600; letter-spacing: 0.5px;}
select { padding: 8px 12px; border-radius: 6px; border: 1px solid #ccc; font-size: 0.9rem; cursor: pointer;}
select:disabled { background: #f0f0f0; cursor: not-allowed;}

.btn-delete { background: #ffebee; color: #d32f2f; border: 1px solid #ffcdd2; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;}
.btn-delete:hover:not(:disabled) { background: #d32f2f; color: white; border-color: #d32f2f;}
.btn-delete:disabled { background: #f5f5f5; color: #aaa; border-color: #ddd; cursor: not-allowed; }
</style>