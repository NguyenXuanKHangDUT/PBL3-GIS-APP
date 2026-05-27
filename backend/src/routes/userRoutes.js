import express from 'express';
import { getAllUsers, deleteUser, updateUserRole, createUser, changePassword } from '../controllers/userController.js';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, isAdmin, getAllUsers);

router.post('/', verifyToken, isAdmin, createUser);

router.put('/:id/role', verifyToken, isAdmin, updateUserRole);

router.delete('/:id', verifyToken, isAdmin, deleteUser);

router.put('/profile/password', verifyToken, changePassword);

export default router;