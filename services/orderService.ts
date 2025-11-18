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
        // Xử lý upload ảnh. Nếu lỗi thì bỏ qua ảnh để vẫn lưu được đơn hàng.
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                // Tạm thời tắt upload ảnh để tránh lỗi treo do CORS/Mạng
                // Khi nào sửa xong CORS thì mở lại dòng dưới:
                // const cloudUrl = await uploadImageToStorage(item.previewImageUrl, order.id, Date.now());
                
                // Trả về chuỗi rỗng để đơn hàng đi qua an toàn
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

// 2. Hàm tra cứu đơn hàng (Dùng cho trang "Tra cứu")
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
        // Lấy đơn hàng, sắp xếp cái mới nhất lên đầu
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

// 4. Hàm cập nhật trạng thái đơn hàng
export const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: newStatus
        });
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật trạng thái:", error);
        return false;
    }
};