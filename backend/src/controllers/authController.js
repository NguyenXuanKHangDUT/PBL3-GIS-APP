import pool from '../config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await pool.query(
            'SELECT id, username, role, password FROM users WHERE username = ?', 
            [username]
        );

        if (users.length > 0) {
            const user = users[0];
            
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu!' });
            }
            
            const token = jwt.sign(
                { id: user.id, role: user.role },
                process.env.JWT_SECRET || 'gis_secret_key',
                { expiresIn: '24h' }
            );

            delete user.password;

            res.json({ 
                success: true, 
                message: 'Đăng nhập thành công!', 
                token: token, 
                data: user 
            });
        } else {
            res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server: ' + error.message });
    }
};