import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, role FROM users');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        if (req.user.id == id) {
            return res.status(400).json({ success: false, message: 'Không thể tự xóa tài khoản của chính mình!' });
        }
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'Đã xóa tài khoản thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    if (req.user.id == id) {
        return res.status(400).json({ success: false, message: 'Không thể tự thay đổi quyền của chính mình!' });
    }

    try {
        if (id == 1) {
            return res.status(403).json({ success: false, message: 'Không thể thay đổi quyền của Admin hệ thống!' });
        }

        await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        res.json({ success: true, message: 'Đã cập nhật quyền thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createUser = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại!' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role || 'user']
        );

        res.json({ success: true, message: 'Tạo tài khoản thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy user' });

        const isMatch = await bcrypt.compare(oldPassword, users[0].password);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác!' });

        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);
        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};