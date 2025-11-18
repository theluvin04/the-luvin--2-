// services/orderService.ts
import { db, storage } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Order } from '../types';

// Hàm phụ: Upload ảnh từ chuỗi Base64 (ảnh thiết kế) lên Firebase Storage
const uploadImageToStorage = async (dataUrl: string, orderId: string, timestamp: number) => {
    try {
        // Tạo đường dẫn file: orders/Mã_Đơn/ảnh.png
        const storageRef = ref(storage, `orders/${orderId}/preview_${timestamp}.png`);
        // Upload
        await uploadString(storageRef, dataUrl, 'data_url');
        // Lấy link tải về (URL ngắn gọn)
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        return null; // Nếu lỗi thì trả về null
    }
};

// 1. Hàm tạo đơn hàng mới (Dùng khi bấm "Đặt hàng")
export const createOrder = async (order: Omit<Order, 'status'>) => {
    try {
        // Xử lý upload ảnh.
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            // Kiểm tra xem có phải là ảnh chụp màn hình (base64) không
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                
                // --- MỞ LẠI TÍNH NĂNG UPLOAD TẠI ĐÂY ---
                // Upload lên Firebase để lấy link ngắn gọn
                const cloudUrl = await uploadImageToStorage(item.previewImageUrl, order.id, Date.now());
                
                // Nếu upload thành công -> Lưu link ảnh xịn
                // Nếu thất bại (do mạng...) -> Lưu chuỗi rỗng (để cứu đơn hàng không bị lỗi)
                return { ...item, previewImageUrl: cloudUrl || "" };
            }
            // Nếu là ảnh có sẵn (link online) thì giữ nguyên
            return item;
        }));

        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
            status: "Chờ thanh toán", // Trạng thái mặc định
            internalNotes: "",
            isUrgent: false,
            adminDeadline: ""
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

// 3. Hàm lấy toàn bộ danh sách đơn hàng (cho trang Admin)
export const getAllOrders = async (): Promise<Order[]> => {
    try {
        const q = query(collection(db, "orders"), orderBy("id", "desc")); 
        const querySnapshot = await getDocs(q);
        
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => {
            orders.push(doc.data() as Order);
        });
        return orders;
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn:", error);
        return [];
    }
};

// 4. Hàm cập nhật thông tin đơn hàng (Status, Ghi chú, Cờ gấp...)
export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, updates);
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật đơn hàng:", error);
        return false;
    }
};