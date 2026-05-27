import { createRouter, createWebHistory } from 'vue-router'
import MapDashboard from '../views/MapDashboard.vue'
import UserManagement from '../views/UserManagement.vue'
import LoginView from '../views/LoginView.vue'
import ProfileView from '../views/ProfileView.vue'
import AnalyticsView from '../views/AnalyticsView.vue'

const routes = [
  { path: '/', component: LoginView },
  { path: '/map', component: MapDashboard },
  { 
    path: '/users', 
    component: UserManagement,
    meta: { requiresAdmin: true } // Đánh dấu trang này cần quyền Admin
  },
  { path: '/profile', component: ProfileView },
  { path: '/analytics', component: AnalyticsView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/* TRẠM KIỂM SOÁT DI CHUYỂN */
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('user_role');

  // 1. Nếu trang yêu cầu Admin mà người dùng không phải Admin
  if (to.meta.requiresAdmin && role !== 'admin') {
    alert("Khu vực hạn chế! Bạn không có quyền truy cập.");
    return next('/map');
  }

  // 2. Nếu chưa đăng nhập mà cố vào các trang Dashboard
  if (to.path !== '/' && !token) {
    return next('/');
  }

  next();
})

export default router