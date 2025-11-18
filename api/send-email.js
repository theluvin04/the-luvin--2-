// api/send-email.js
import nodemailer from 'nodemailer';

// Cấu hình tài khoản gửi mail (Nên dùng biến môi trường, nhưng hardcode tạm để test)
// SAU NÀY NÊN ĐƯA VÀO FILE .env ĐỂ BẢO MẬT
const EMAIL_USER = "theluvin.gifts@gmail.com"; // Thay bằng email của bạn
const EMAIL_PASS = "xxxx xxxx xxxx xxxx";      // Thay bằng Mật khẩu ứng dụng 16 ký tự bạn vừa lấy

export default async function handler(req, res) {
    // Chỉ chấp nhận method POST
    if (req.method !== 'POST') {
        return res.status(405).send({ message: 'Only POST requests allowed' });
    }

    const { to_name, to_email, order_id, total_price, address, items_list } = req.body;

    // Tạo transporter (người vận chuyển)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    });

    // Nội dung email
    const mailOptions = {
        from: `"The Luvin" <${EMAIL_USER}>`,
        to: to_email, // Gửi đến khách hàng
        subject: `Xác nhận đơn hàng ${order_id} - The Luvin`,
        text: `
Xin chào ${to_name},

Cảm ơn bạn đã đặt hàng tại The Luvin! Đơn hàng của bạn đã được ghi nhận.

📦 Mã đơn hàng: ${order_id}
💰 Tổng tiền: ${total_price}
📍 Địa chỉ nhận: ${address}

Chi tiết sản phẩm:
${items_list}

-------------------------
Chúng tôi sẽ sớm liên hệ để xác nhận và giao hàng.
Hotline: 0964 393 115
        `,
        // Bạn có thể thêm html: '<h1>...</h1>' nếu muốn email đẹp hơn
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}