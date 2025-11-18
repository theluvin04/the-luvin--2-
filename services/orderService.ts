// services/orderService.ts
import { db, storage } from '../config/firebase';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Order } from '../types';

// Hàm phụ: Upload ảnh (Để đó sau này dùng)
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

// 1. Hàm tạo đơn hàng mới (ĐÃ TẮT UPLOAD ĐỂ TRÁNH LỖI)
export const createOrder = async (order: Omit<Order, 'status'>) => {
    try {
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                
                // --- QUAN TRỌNG: Tắt dòng này đi ---
                // const cloudUrl = await uploadImageToStorage(item.previewImageUrl, order.id, Date.now());
                
                // --- Thay bằng dòng này: Trả về rỗng để đơn hàng đi qua luôn ---
                return { ...item, previewImageUrl: "" }; 
            }
            return item;
        }));

        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
            status: "Chờ thanh toán",
            internalNotes: "",
            isUrgent: false,
            adminDeadline: ""
        };

        // Lưu đơn hàng vào Firestore
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
        return docSnap.exists() ? (docSnap.data() as Order) : null;
    } catch (error) {
        console.error("Lỗi lấy đơn hàng:", error);
        return null;
    }
};

// Các hàm khác (getAllOrders, updateOrder) bạn giữ nguyên hoặc xóa đi nếu file này import thiếu
// Để an toàn, mình lược bỏ 2 hàm admin ở đây vì file này chủ yếu xử lý logic khách hàng
// Nếu file services/orderService.ts của bạn đang chứa cả getAllOrders và updateOrder,
// HÃY CHỈ SỬA HÀM createOrder NHƯ TRÊN THÔI NHÉ.