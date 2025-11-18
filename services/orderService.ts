// services/orderService.ts
import { db, storage } from '../config/firebase';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Order } from '../types';

// Hàm phụ: Upload ảnh (Giữ nguyên để sau này dùng lại)
const uploadImageToStorage = async (dataUrl: string, orderId: string, timestamp: number) => {
    try {
        const storageRef = ref(storage, `orders/${orderId}/preview_${timestamp}.png`);
        await uploadString(storageRef, dataUrl, 'data_url');
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        return null;
    }
};

// 1. Hàm tạo đơn hàng mới (Đã tắt upload ảnh để fix lỗi treo)
export const createOrder = async (order: Omit<Order, 'status'>) => {
    try {
        // Xử lý danh sách sản phẩm
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            // Kiểm tra nếu có ảnh base64
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                
                // --- ĐOẠN SỬA QUAN TRỌNG ---
                // Tạm thời KHÔNG gọi hàm upload để tránh bị treo do lỗi mạng/CORS
                // const cloudUrl = await uploadImageToStorage(item.previewImageUrl, order.id, Date.now());
                
                // Thay vào đó, ta trả về chuỗi rỗng. 
                // Việc này giúp đơn hàng nhẹ tênh và đi thẳng vào database ngay lập tức.
                return { ...item, previewImageUrl: "" }; 
            }
            return item;
        }));

        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
            status: "Chờ thanh toán", // Trạng thái mặc định
        };

        // Lưu vào Firestore với ID là mã đơn hàng
        await setDoc(doc(db, "orders", order.id), finalOrder);

        return { success: true, data: finalOrder };
    } catch (error) {
        console.error("Lỗi tạo đơn hàng:", error);
        return { success: false, error };
    }
};

// 2. Hàm tra cứu đơn hàng
export const getOrderById = async (orderId: string): Promise<Order | null> => {
    try {
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as Order;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Lỗi lấy đơn hàng:", error);
        return null;
    }
};